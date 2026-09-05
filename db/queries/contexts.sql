-- name: GetContext :one
SELECT * FROM contexts WHERE id = $1;

-- Parents before children, then by position — the order listContexts promises.
--
-- Both halves come from context_tree.sort_path, which carries the (position,
-- name) of every node on the way down. Ordering by contexts.position alone gets
-- the second half and loses the first: positions are handed out per owner, not
-- per branch, so a child created early sorts above its own parent.
--
-- The filter is on the row's own is_archived, so a live child of an archived
-- parent still appears. It has not been archived, and hiding it would make it
-- unreachable without saying so.
-- name: ListContexts :many
SELECT c.*
FROM contexts c
JOIN context_tree t ON t.id = c.id
WHERE c.user_id = @user_id
  AND (@include_archived::boolean OR NOT c.is_archived)
ORDER BY t.sort_path;

-- CountLiveChildren backs the refusal to archive a parent out from under its
-- children. Counted rather than checked with EXISTS so the error can say how
-- many are in the way.
-- name: CountLiveChildren :one
SELECT count(*)::integer FROM contexts
WHERE parent_id = @parent_id AND NOT is_archived;

-- IsDescendant reports whether candidate sits anywhere below root.
--
-- Re-nesting has to refuse a move into the context's own subtree. The cycle
-- trigger would catch it too, but only as a check_violation with no way to tell
-- it apart from breaching the depth cap — and the two need different messages.
-- name: IsDescendant :one
SELECT EXISTS (
    SELECT 1 FROM context_tree
    WHERE id = @candidate_id AND @root_id::uuid = ANY(ancestry)
)::boolean;

-- UpdateContext applies a partial change.
--
-- Each nullable column takes a pair: the value, and a boolean saying whether
-- this request mentioned it at all. COALESCE cannot express that difference —
-- it reads an explicit null as "unchanged", which would make clearing a colour
-- or promoting a context to the top level impossible.
--
-- slug is absent on purpose: it is immutable.
-- name: UpdateContext :one
UPDATE contexts
SET
    name         = COALESCE(sqlc.narg('name'), name),
    is_archived  = COALESCE(sqlc.narg('is_archived'), is_archived),
    color        = CASE WHEN @set_color::boolean
                        THEN sqlc.narg('color')::text ELSE color END,
    parent_id    = CASE WHEN @set_parent_id::boolean
                        THEN sqlc.narg('parent_id')::uuid ELSE parent_id END,
    tone_profile = CASE WHEN @set_tone_profile::boolean
                        THEN sqlc.narg('tone_profile')::text ELSE tone_profile END
WHERE id = @id AND user_id = @user_id
RETURNING *;

-- ArchiveContext is idempotent: archiving one that is already archived returns
-- the row rather than nothing, because the caller asked for a state and that
-- state holds.
-- name: ArchiveContext :one
UPDATE contexts SET is_archived = true
WHERE id = @id AND user_id = @user_id
RETURNING *;

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
-- share a position, and context_tree.sort_path breaks that tie by name.
-- name: NextContextPosition :one
SELECT COALESCE(MAX(position) + 1, 0)::integer FROM contexts WHERE user_id = $1;
