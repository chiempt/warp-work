-- name: GetContext :one
SELECT * FROM contexts WHERE id = $1;

-- name: ListContexts :many
SELECT *
FROM contexts
WHERE user_id = $1
  AND (NOT @exclude_archived::boolean OR NOT is_archived)
ORDER BY parent_id NULLS FIRST, name;

-- name: CreateContext :one
INSERT INTO contexts (id, user_id, parent_id, name, kind, active_hours, tone_profile, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
RETURNING *;
