-- Deterministic routing rules.
--
-- Evaluated before any model call; most traffic never reaches a model.

-- +goose Up

CREATE TYPE routing_match_type AS ENUM ('sender', 'domain', 'keyword', 'subject', 'thread');

-- Cheap deterministic routing, evaluated before any model call.
CREATE TABLE routing_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id  uuid               NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    match_type  routing_match_type NOT NULL,
    -- Stored lowercase so matching never depends on how the sender typed it.
    match_value text               NOT NULL,
    priority    integer            NOT NULL DEFAULT 100,
    is_active   boolean            NOT NULL DEFAULT true,
    created_at  timestamptz        NOT NULL DEFAULT now(),
    updated_at  timestamptz        NOT NULL DEFAULT now(),

    CONSTRAINT routing_rules_value_lowercase CHECK (match_value = lower(match_value)),
    CONSTRAINT routing_rules_value_not_blank CHECK (length(btrim(match_value)) > 0),
    CONSTRAINT routing_rules_unique_match UNIQUE (context_id, match_type, match_value)
);

CREATE INDEX routing_rules_lookup_idx ON routing_rules (user_id, match_type, match_value)
    WHERE is_active = true;

CREATE TRIGGER routing_rules_set_updated_at
    BEFORE UPDATE ON routing_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS routing_rules;
DROP TYPE IF EXISTS routing_match_type;
