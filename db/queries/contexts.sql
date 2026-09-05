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
INSERT INTO contexts (id, user_id, parent_id, slug, name, color, active_hours, tone_profile, position)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- NextContextPosition places a new context after the ones that exist.
--
-- Read separately rather than computed inside the insert so the insert stays a
-- plain statement sqlc can type. A race here costs nothing: two contexts would
-- share a position, and ListContexts breaks that tie by name.
-- name: NextContextPosition :one
SELECT COALESCE(MAX(position) + 1, 0)::integer FROM contexts WHERE user_id = $1;
