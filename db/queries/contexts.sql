-- name: GetContext :one
SELECT * FROM contexts WHERE id = $1;

-- name: ListContexts :many
SELECT *
FROM contexts
WHERE user_id = $1
  AND (@include_archived::boolean OR NOT is_archived)
ORDER BY position, name;

-- id is supplied by the application as UUIDv7 rather than taken from the
-- column default, so rows sort by creation time. See docs/conventions.md §3.
-- created_at and updated_at come from defaults and a trigger.
-- name: CreateContext :one
INSERT INTO contexts (id, user_id, parent_id, slug, name, kind, color, active_hours, tone_profile, position)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;
