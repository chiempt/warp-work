-- name: GetTask :one
SELECT * FROM tasks WHERE id = $1;

-- name: ListTasks :many
SELECT *
FROM tasks
WHERE user_id = $1
ORDER BY created_at DESC, priority DESC;

-- id is supplied by the application as UUIDv7 rather than taken from the
-- column default, so rows sort by creation time. See docs/conventions.md §3.
-- created_at and updated_at come from defaults and a trigger.
-- name: CreateTask :one
INSERT INTO tasks (id, user_id, parent_task_id, title, commitment_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- NextTaskPosition places a new task after the ones that exist.
--
-- Read separately rather than computed inside the insert so the insert stays a
-- plain statement sqlc can type. A race here costs nothing: two tasks would
-- share a position, and ListTasks breaks that tie by name.
-- name: NextTaskPosition :one
SELECT COALESCE(MAX(position) + 1, 0)::integer FROM tasks WHERE user_id = $1;
