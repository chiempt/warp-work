-- `context_tree` could say who descends from whom, but not what order to show
-- them in.
--
-- The view already walks the tree and carries `ancestry`, the uuid path from
-- root to node. Ordering by that puts parents before children, which is half of
-- what listContexts promises. The other half — "then by position" — it cannot
-- do: uuids sort by their bytes, so siblings come back in an order nobody chose.
--
-- So the walk also accumulates the (position, name) of every node it passes
-- through. Ordering by `sort_path` is then depth-first with siblings in the
-- order the owner arranged them: the whole promise in one ORDER BY.
--
-- Added to the view rather than written into db/queries, because a second
-- recursive CTE there would be this same walk maintained twice.

-- +goose Up

-- A step carries the name as well as the position, and that is the point.
-- Position alone is not unique among siblings — the seeds already contain two
-- pairs that tie — and a tie at one level would let the descendants of the tied
-- nodes interleave with each other further down. Comparing composites field by
-- field breaks the tie at the level it happens, so a subtree always stays whole.
CREATE TYPE context_sort_step AS (
    position integer,
    name     text
);

-- CREATE OR REPLACE keeps the existing columns in place and appends the new one,
-- so anything already selecting from this view is unaffected.
CREATE OR REPLACE VIEW context_tree AS
WITH RECURSIVE walk AS (
    SELECT
        c.id,
        c.user_id,
        c.id        AS root_id,
        c.name      AS path,
        0           AS depth,
        ARRAY[c.id] AS ancestry,
        ARRAY[(c.position, c.name)::context_sort_step] AS sort_path
    FROM contexts c
    WHERE c.parent_id IS NULL

    UNION ALL

    SELECT
        c.id,
        c.user_id,
        w.root_id,
        w.path || ' / ' || c.name,
        w.depth + 1,
        w.ancestry || c.id,
        w.sort_path || (c.position, c.name)::context_sort_step
    FROM contexts c
    JOIN walk w ON c.parent_id = w.id
)
SELECT * FROM walk;

-- +goose Down

CREATE OR REPLACE VIEW context_tree AS
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

DROP TYPE context_sort_step;
