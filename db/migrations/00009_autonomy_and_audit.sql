-- +goose Up

-- Autonomy is a property of the pair (context, action type), never of the
-- system as a whole. Everything starts at 'draft'.
CREATE TABLE autonomy_rules (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id       uuid           NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    action_type_code text           NOT NULL REFERENCES action_types (code) ON DELETE CASCADE,
    level            autonomy_level NOT NULL DEFAULT 'draft',
    -- Set when the user accepts an upgrade proposal, for later review.
    promoted_at      timestamptz,
    created_at       timestamptz    NOT NULL DEFAULT now(),
    updated_at       timestamptz    NOT NULL DEFAULT now(),

    CONSTRAINT autonomy_rules_unique UNIQUE (context_id, action_type_code)
);

CREATE INDEX autonomy_rules_auto_idx ON autonomy_rules (context_id)
    WHERE level = 'auto';

CREATE TRIGGER autonomy_rules_set_updated_at
    BEFORE UPDATE ON autonomy_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Every review outcome becomes evidence. Enough consecutive clean approvals and
-- the system offers to raise the level. Trust is earned, never assumed.
CREATE TABLE autonomy_evidence (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    autonomy_rule_id   uuid             NOT NULL REFERENCES autonomy_rules (id) ON DELETE CASCADE,
    proposed_action_id uuid             NOT NULL UNIQUE
                           REFERENCES proposed_actions (id) ON DELETE CASCADE,
    outcome            autonomy_outcome NOT NULL,
    created_at         timestamptz      NOT NULL DEFAULT now()
);

-- The streak query: latest outcomes for one rule, newest first.
CREATE INDEX autonomy_evidence_streak_idx
    ON autonomy_evidence (autonomy_rule_id, created_at DESC);

CREATE TABLE reports (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_id   uuid        REFERENCES work_sessions (id) ON DELETE SET NULL,
    kind         report_kind NOT NULL,
    period_start timestamptz NOT NULL,
    period_end   timestamptz NOT NULL,
    content_md   text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT reports_period_order CHECK (period_end >= period_start),
    CONSTRAINT reports_session_kind CHECK (
        (kind = 'session' AND session_id IS NOT NULL)
        OR (kind <> 'session')
    )
);

CREATE INDEX reports_recent_idx ON reports (user_id, kind, period_start DESC);

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
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS autonomy_evidence;
DROP TABLE IF EXISTS autonomy_rules;
