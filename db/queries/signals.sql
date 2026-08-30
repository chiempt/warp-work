-- IngestSignal is idempotent. Re-running a sync over items already seen returns
-- the stored rows untouched rather than writing new ones — signals are
-- immutable, and a database trigger enforces that too.
-- name: IngestSignal :one
INSERT INTO signals (id, account_id, external_id, kind, payload, content_hash, occurred_at, ingested_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (account_id, external_id) DO NOTHING
RETURNING *;

-- name: GetSignalByExternalID :one
SELECT * FROM signals WHERE account_id = $1 AND external_id = $2;

-- ListUnroutedSignals feeds the router. Oldest first, so a backlog drains in
-- the order things actually happened.
-- name: ListUnroutedSignals :many
SELECT s.*
FROM signals s
WHERE s.processed_at IS NULL
  AND s.account_id = ANY (@account_ids::uuid[])
ORDER BY s.ingested_at
LIMIT @row_limit;

-- MarkSignalProcessed sets the only column on a signal that may ever change.
-- name: MarkSignalProcessed :exec
UPDATE signals SET processed_at = $2 WHERE id = $1;

-- ListContextTimeline is the read path behind the timeline view. It is
-- context-scoped by construction: there is no unfiltered signal listing.
-- name: ListContextTimeline :many
SELECT s.*, sc.confidence, sc.assigned_by
FROM signals s
JOIN signal_contexts sc ON sc.signal_id = s.id
WHERE sc.context_id = ANY (@context_ids::uuid[])
  AND s.occurred_at < @before::timestamptz
ORDER BY s.occurred_at DESC
LIMIT @row_limit;
