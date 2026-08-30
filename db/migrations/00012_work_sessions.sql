-- The clock-in. Scopes which contexts agents may touch.
--
-- Not an auth session — see docs/glossary.md.

-- +goose Up

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

-- +goose Down

DROP TABLE IF EXISTS work_session_contexts;
DROP TABLE IF EXISTS work_sessions;
