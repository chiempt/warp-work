-- +goose Up

-- Overdue is derived, never stored, so it can never go stale.
CREATE VIEW commitments_live AS
SELECT
    c.*,
    (c.due_at IS NOT NULL AND c.due_at < now()) AS is_overdue,
    CASE
        WHEN c.due_at IS NULL THEN NULL
        ELSE date_part('day', now() - c.due_at)::integer
    END AS days_overdue
FROM commitments c
WHERE c.status = 'open';

-- Full ancestry of every context, for inheriting settings from a parent and for
-- session scoping: opening job A should also open its children.
CREATE VIEW context_tree AS
WITH RECURSIVE walk AS (
    SELECT
        c.id,
        c.user_id,
        c.id        AS root_id,
        c.name      AS path,
        0           AS depth,
        ARRAY[c.id] AS ancestry
    FROM contexts c
    WHERE c.parent_id IS NULL

    UNION ALL

    SELECT
        c.id,
        c.user_id,
        w.root_id,
        w.path || ' / ' || c.name,
        w.depth + 1,
        w.ancestry || c.id
    FROM contexts c
    JOIN walk w ON c.parent_id = w.id
)
SELECT * FROM walk;

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
DROP VIEW IF EXISTS context_tree;
DROP VIEW IF EXISTS commitments_live;
