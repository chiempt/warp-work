-- Trust, earned per (context, action type) and never granted globally.

-- +goose Up

CREATE TYPE autonomy_outcome AS ENUM ('approved_unchanged', 'edited', 'rejected');

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

-- Consecutive clean approvals per autonomy rule, counting back from the most
-- recent review. One edit or rejection resets the streak to zero. Drives the
-- "may I stop asking about this?" prompt.
CREATE VIEW autonomy_streaks AS
SELECT
    r.id   AS autonomy_rule_id,
    r.context_id,
    r.action_type_code,
    r.level,
    a.upgrade_threshold,
    s.clean_streak,
    (r.level <> 'auto' AND s.clean_streak >= a.upgrade_threshold) AS upgrade_ready
FROM autonomy_rules r
JOIN action_types a ON a.code = r.action_type_code
LEFT JOIN LATERAL (
    WITH ranked AS (
        SELECT
            e.outcome,
            row_number() OVER (ORDER BY e.created_at DESC) AS rn
        FROM autonomy_evidence e
        WHERE e.autonomy_rule_id = r.id
    )
    SELECT COALESCE(
        (SELECT min(rn) - 1 FROM ranked WHERE outcome <> 'approved_unchanged'),
        (SELECT count(*) FROM ranked)
    )::integer AS clean_streak
) s ON true;

-- +goose Down

DROP VIEW IF EXISTS autonomy_streaks;
DROP TABLE IF EXISTS autonomy_evidence;
DROP TABLE IF EXISTS autonomy_rules;
DROP TYPE IF EXISTS autonomy_outcome;
