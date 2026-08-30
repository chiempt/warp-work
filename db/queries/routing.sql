-- name: ListActiveRoutingRules :many
SELECT r.*
FROM routing_rules r
JOIN contexts c ON c.id = r.context_id
WHERE c.user_id = $1
  AND r.is_active
  AND NOT c.is_archived
ORDER BY r.priority, r.id;

-- name: AssignSignalContext :exec
INSERT INTO signal_contexts (signal_id, context_id, confidence, assigned_by, created_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (signal_id, context_id) DO UPDATE
SET confidence  = EXCLUDED.confidence,
    assigned_by = EXCLUDED.assigned_by;

-- ListLowConfidenceAssignments backs the manual routing queue. The threshold is
-- open question 1 — the caller supplies it rather than the query assuming one.
-- name: ListLowConfidenceAssignments :many
SELECT sc.*
FROM signal_contexts sc
WHERE sc.assigned_by = 'model'
  AND sc.confidence < @threshold::double precision
ORDER BY sc.confidence;
