-- `kind` and `color` were two answers to one question, and only one of them was
-- ever asked.
--
-- `contexts.kind` had exactly one consumer in the whole system: the interface
-- mapped it to a colour. Nothing filtered on it, no routing rule read it, no
-- autonomy rule keyed off it. Meanwhile `color` sat beside it, written by the
-- API, stored, and read by nobody.
--
-- Worse, `kind` was a native ENUM, and per CLAUDE.md a value can never be
-- removed from one. So `work | study | personal` was a permanent taxonomy of
-- one person's life, decided before that person had filed a single signal.
-- Insurance work, a side contract, family, health — each would have needed a
-- migration to name, and could never be unnamed.
--
-- The tree already groups. A root context called "Work" with children under it
-- *is* the kind, and it costs nothing to add another root. So the taxonomy goes
-- and the colour stays.
--
-- `color` is text with a CHECK rather than a second ENUM, deliberately: a CHECK
-- can be widened *and narrowed* in a later migration, which is the property the
-- ENUM lacked and the reason this migration exists at all.

-- +goose Up

-- Hue names, not life-area names. The whole point is that picking a colour must
-- not require inventing a category first.
ALTER TABLE contexts
    ADD CONSTRAINT contexts_color_token CHECK (
        color IS NULL
        OR color IN ('slate', 'blue', 'violet', 'green', 'teal', 'rose')
    ) NOT VALID;

-- Carry the existing hues across unchanged, so the interface looks identical
-- either side of this migration: the tokens behind work/study/personal were
-- oklch hue 248, 300 and 155 — blue, violet and green.
UPDATE contexts
SET color = CASE kind
    WHEN 'work'     THEN 'blue'
    WHEN 'study'    THEN 'violet'
    WHEN 'personal' THEN 'green'
END
WHERE color IS NULL;

-- Backfilled, so the constraint can now be proven over existing rows.
ALTER TABLE contexts VALIDATE CONSTRAINT contexts_color_token;

ALTER TABLE contexts DROP COLUMN kind;

DROP TYPE context_kind;

-- Eight levels of life area is a filing cabinet, not a life. Three tiers is
-- already generous for one person — "Work / Client / Project" reaches it — and
-- the cap exists to stop a recursive query walking a mistake, not to express
-- ambition.
--
-- `depth` counts ancestors, so two ancestors is three tiers. The original wrote
-- `> 8` and said "8 levels", which was one out.
--
-- Replaced rather than edited in 00004: that migration has been applied.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION contexts_prevent_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ancestor uuid := NEW.parent_id;
    depth    integer := 0;
BEGIN
    WHILE ancestor IS NOT NULL LOOP
        IF ancestor = NEW.id THEN
            RAISE EXCEPTION 'context cycle detected involving %', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;

        depth := depth + 1;
        IF depth > 2 THEN
            RAISE EXCEPTION 'context nested deeper than 3 levels'
                USING ERRCODE = 'check_violation';
        END IF;

        SELECT parent_id INTO ancestor FROM contexts WHERE id = ancestor;
    END LOOP;

    RETURN NEW;
END;
$$;
-- +goose StatementEnd

-- +goose Down

CREATE TYPE context_kind AS ENUM ('work', 'study', 'personal');

ALTER TABLE contexts ADD COLUMN kind context_kind;

-- The inverse of the backfill above. A colour this migration did not introduce
-- has no kind to go back to, so it lands on 'personal' rather than blocking the
-- rollback — down migrations restore a shape, not a history.
UPDATE contexts
SET kind = CASE color
    WHEN 'blue'   THEN 'work'::context_kind
    WHEN 'violet' THEN 'study'::context_kind
    ELSE               'personal'::context_kind
END;

ALTER TABLE contexts ALTER COLUMN kind SET NOT NULL;

ALTER TABLE contexts DROP CONSTRAINT contexts_color_token;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION contexts_prevent_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    ancestor uuid := NEW.parent_id;
    depth    integer := 0;
BEGIN
    WHILE ancestor IS NOT NULL LOOP
        IF ancestor = NEW.id THEN
            RAISE EXCEPTION 'context cycle detected involving %', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;

        depth := depth + 1;
        IF depth > 8 THEN
            RAISE EXCEPTION 'context tree deeper than 8 levels'
                USING ERRCODE = 'check_violation';
        END IF;

        SELECT parent_id INTO ancestor FROM contexts WHERE id = ancestor;
    END LOOP;

    RETURN NEW;
END;
$$;
-- +goose StatementEnd
