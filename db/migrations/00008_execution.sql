-- +goose Up

-- Catalogue of what an agent is allowed to attempt. Referenced by autonomy
-- rules, runs and proposed actions, so adding a capability is a data change
-- rather than a schema change.
CREATE TABLE action_types (
    code        text PRIMARY KEY,
    label       text        NOT NULL,
    -- true when performing it changes something outside Warp.
    is_outbound boolean     NOT NULL,
    risk        action_risk NOT NULL,
    -- Consecutive clean approvals required before an autonomy upgrade is offered.
    upgrade_threshold smallint NOT NULL DEFAULT 10,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT action_types_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT action_types_threshold_positive CHECK (upgrade_threshold > 0)
);

-- Prompts live in the database, not in compiled Go. Tuning extraction should
-- not require a rebuild, and every run records which version produced it.
CREATE TABLE prompt_templates (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    version    integer     NOT NULL,
    body       text        NOT NULL,
    variables  jsonb       NOT NULL DEFAULT '[]'::jsonb,
    model      text        NOT NULL,
    max_tokens integer     NOT NULL DEFAULT 4096,
    is_active  boolean     NOT NULL DEFAULT false,
    notes      text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT prompt_templates_unique_version UNIQUE (name, version),
    CONSTRAINT prompt_templates_version_positive CHECK (version > 0),
    CONSTRAINT prompt_templates_body_not_blank CHECK (length(btrim(body)) > 0)
);

-- At most one active version per prompt name.
CREATE UNIQUE INDEX prompt_templates_one_active_idx ON prompt_templates (name)
    WHERE is_active = true;

-- Clocking in. Agents never run outside an open session, and a session scopes
-- which contexts they may touch.
CREATE TABLE work_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label            text,
    started_at       timestamptz   NOT NULL DEFAULT now(),
    ended_at         timestamptz,
    tokens_in        bigint        NOT NULL DEFAULT 0,
    tokens_out       bigint        NOT NULL DEFAULT 0,
    cost_usd         numeric(10,4) NOT NULL DEFAULT 0,
    -- Hard stop. The worker refuses to start new runs once this is reached.
    token_budget     bigint,
    created_at       timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT work_sessions_time_order CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT work_sessions_counters_nonneg CHECK (tokens_in >= 0 AND tokens_out >= 0)
);

-- Only one session may be open at a time. This is the safety property that
-- keeps agent activity bounded and attributable.
CREATE UNIQUE INDEX work_sessions_one_open_idx ON work_sessions (user_id)
    WHERE ended_at IS NULL;

CREATE INDEX work_sessions_recent_idx ON work_sessions (user_id, started_at DESC);

CREATE TABLE work_session_contexts (
    session_id uuid NOT NULL REFERENCES work_sessions (id) ON DELETE CASCADE,
    context_id uuid NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, context_id)
);

CREATE INDEX work_session_contexts_context_idx ON work_session_contexts (context_id);

-- One attempt by an agent at one action.
CREATE TABLE runs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id         uuid           NOT NULL REFERENCES work_sessions (id) ON DELETE CASCADE,
    context_id         uuid           NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    task_id            uuid           REFERENCES tasks (id) ON DELETE SET NULL,
    action_type_code   text           NOT NULL REFERENCES action_types (code) ON DELETE RESTRICT,
    prompt_template_id uuid           REFERENCES prompt_templates (id) ON DELETE SET NULL,
    -- Recorded at dispatch time, so later rule changes cannot rewrite history.
    autonomy_applied   autonomy_level NOT NULL,
    model              text           NOT NULL,
    status             run_status     NOT NULL DEFAULT 'queued',
    tokens_in          integer        NOT NULL DEFAULT 0,
    tokens_out         integer        NOT NULL DEFAULT 0,
    cost_usd           numeric(10,4)  NOT NULL DEFAULT 0,
    started_at         timestamptz,
    ended_at           timestamptz,
    error              text,
    created_at         timestamptz    NOT NULL DEFAULT now(),

    CONSTRAINT runs_time_order CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
    CONSTRAINT runs_failure_has_error CHECK (status <> 'failed' OR error IS NOT NULL)
);

CREATE INDEX runs_session_idx ON runs (session_id, created_at);
CREATE INDEX runs_pending_idx ON runs (created_at)
    WHERE status IN ('queued', 'running');
CREATE INDEX runs_task_idx ON runs (task_id);
CREATE INDEX runs_prompt_idx ON runs (prompt_template_id);

-- Tool-by-tool trace. Without this, agent failures are unexplainable.
CREATE TABLE run_steps (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      uuid        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    step_no     smallint    NOT NULL,
    tool        text        NOT NULL,
    input       jsonb,
    output      jsonb,
    duration_ms integer,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT run_steps_unique_step UNIQUE (run_id, step_no),
    CONSTRAINT run_steps_step_positive CHECK (step_no > 0)
);

-- The gate. Nothing reaches the outside world without a row here first.
CREATE TABLE proposed_actions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           uuid                  NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    action_type_code text                  NOT NULL REFERENCES action_types (code) ON DELETE RESTRICT,
    payload          jsonb                 NOT NULL,
    -- What the user changed before approving. The difference between payload and
    -- payload_edited is the most valuable training signal the system produces.
    payload_edited   jsonb,
    status           proposed_action_status NOT NULL DEFAULT 'pending',
    review_note      text,
    reviewed_at      timestamptz,
    expires_at       timestamptz,
    created_at       timestamptz           NOT NULL DEFAULT now(),

    CONSTRAINT proposed_actions_review_consistent CHECK (
        (status = 'pending' AND reviewed_at IS NULL)
        OR (status <> 'pending' AND reviewed_at IS NOT NULL)
    ),
    -- 'edited' means the user changed something; anything else means they did not.
    CONSTRAINT proposed_actions_edit_consistent CHECK (
        (status = 'edited' AND payload_edited IS NOT NULL)
        OR (status <> 'edited' AND payload_edited IS NULL)
    )
);

CREATE INDEX proposed_actions_queue_idx ON proposed_actions (created_at)
    WHERE status = 'pending';
CREATE INDEX proposed_actions_run_idx ON proposed_actions (run_id);
CREATE INDEX proposed_actions_expiring_idx ON proposed_actions (expires_at)
    WHERE status = 'pending' AND expires_at IS NOT NULL;

-- What actually happened. One row per proposed action, at most.
CREATE TABLE executions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_action_id  uuid             NOT NULL UNIQUE
                            REFERENCES proposed_actions (id) ON DELETE CASCADE,
    result              execution_result NOT NULL,
    -- Provider-side identifier of the thing created: message id, event id.
    external_ref        text,
    -- Whatever the undo path needs: a draft id to delete, an event id to cancel.
    undo_token          text,
    undone_at           timestamptz,
    error               text,
    executed_at         timestamptz      NOT NULL DEFAULT now(),

    CONSTRAINT executions_failure_has_error CHECK (result <> 'failed' OR error IS NOT NULL),
    CONSTRAINT executions_undo_needs_token CHECK (undone_at IS NULL OR undo_token IS NOT NULL)
);

CREATE INDEX executions_recent_idx ON executions (executed_at DESC);
CREATE INDEX executions_undoable_idx ON executions (executed_at DESC)
    WHERE undo_token IS NOT NULL AND undone_at IS NULL;

-- +goose Down

DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS proposed_actions;
DROP TABLE IF EXISTS run_steps;
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS work_session_contexts;
DROP TABLE IF EXISTS work_sessions;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS action_types;
