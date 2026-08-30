-- Who changed what, including the agents.

-- +goose Up

CREATE TYPE audit_actor AS ENUM ('user', 'agent', 'system');

-- Append-only history of every mutation, whoever caused it. bigint identity
-- rather than uuid: this table grows faster than any other and is only ever
-- read in time order.
CREATE TABLE audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    entity_type text        NOT NULL,
    entity_id   uuid,
    action      text        NOT NULL,
    actor       audit_actor NOT NULL,
    -- {"before": {...}, "after": {...}}
    diff        jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);

CREATE INDEX audit_log_time_idx ON audit_log (created_at DESC);

CREATE INDEX audit_log_agent_idx ON audit_log (created_at DESC)
    WHERE actor = 'agent';

-- +goose Down

DROP TABLE IF EXISTS audit_log;
DROP TYPE IF EXISTS audit_actor;
