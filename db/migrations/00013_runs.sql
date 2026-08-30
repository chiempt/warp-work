-- One agent execution inside a session, and its tool-call trail.
--
-- Without run_steps, agent failures are unexplainable.

-- +goose Up

CREATE TYPE run_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

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

-- +goose Down

DROP TABLE IF EXISTS run_steps;
DROP TABLE IF EXISTS runs;
DROP TYPE IF EXISTS run_status;
