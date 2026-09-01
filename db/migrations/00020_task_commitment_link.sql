-- Which task is discharging which promise.
--
-- Left out of 00009, and the gap costs the one question the commitments table
-- exists to answer: a promise falling due with no work running against it. That
-- is not a filter on a board — it is the "forgotten, not difficult" failure the
-- whole table was built to catch, and without this column it cannot be asked.
--
-- The link is for asking, never for deriving. A task reaching 'done' does not
-- fulfil a commitment: done means the owner finished, fulfilled means the other
-- person received what they were waiting for. A quote written at 17:00 and
-- never sent leaves every task closed and the debt untouched. So no trigger
-- propagates between these two tables, in either direction.

-- +goose Up

-- Needed so the foreign key below can reference the pair rather than the id
-- alone. Logically redundant against the primary key; the index it costs buys
-- the context check being enforced by the database instead of remembered by a
-- caller.
ALTER TABLE commitments
    ADD CONSTRAINT commitments_id_context_key UNIQUE (id, context_id);

-- Nullable, and null for most rows: work the owner set themselves has no
-- counterparty waiting on it, and forcing every task to name a promise would
-- invent someone to be waiting.
ALTER TABLE tasks
    ADD COLUMN commitment_id uuid;

-- Two assertions in one constraint: the commitment exists, and it belongs to
-- the same context as the task. A cross-context link is a write error, not a
-- review finding — see CLAUDE.md, hard invariant 2.
--
-- SET NULL names its column. Left bare it would null both columns of the key,
-- and context_id is NOT NULL, so deleting a commitment would fail outright.
--
-- SET NULL rather than CASCADE: deleting a promise must not delete the work
-- already done towards it.
ALTER TABLE tasks
    ADD CONSTRAINT tasks_commitment_same_context
        FOREIGN KEY (commitment_id, context_id)
        REFERENCES commitments (id, context_id)
        ON DELETE SET NULL (commitment_id);

-- Reads in both directions: the tasks running against one promise, and the
-- anti-join behind "due soon, nothing started".
CREATE INDEX tasks_commitment_idx ON tasks (commitment_id)
    WHERE commitment_id IS NOT NULL;

-- +goose Down

DROP INDEX IF EXISTS tasks_commitment_idx;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_commitment_same_context;
ALTER TABLE tasks DROP COLUMN IF EXISTS commitment_id;
ALTER TABLE commitments DROP CONSTRAINT IF EXISTS commitments_id_context_key;
