-- +goose Up

CREATE TABLE users (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email        citext      NOT NULL UNIQUE,
    display_name text        NOT NULL,
    timezone     text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The organising axis of the whole system. Self-referencing tree, max depth 8.
CREATE TABLE contexts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_id     uuid         REFERENCES contexts (id) ON DELETE RESTRICT,
    slug          text         NOT NULL,
    name          text         NOT NULL,
    kind          context_kind NOT NULL,
    color         text,
    -- {"mon":[["09:00","18:00"]], "sat":[]} in the user's timezone
    active_hours  jsonb        NOT NULL DEFAULT '{}'::jsonb,
    tone_profile  text,
    position      integer      NOT NULL DEFAULT 0,
    is_archived   boolean      NOT NULL DEFAULT false,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT contexts_no_self_parent CHECK (parent_id IS DISTINCT FROM id),
    CONSTRAINT contexts_slug_format    CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$'),
    CONSTRAINT contexts_unique_slug    UNIQUE (user_id, slug)
);

CREATE INDEX contexts_user_active_idx ON contexts (user_id, position)
    WHERE is_archived = false;
CREATE INDEX contexts_parent_idx ON contexts (parent_id);

-- A cycle in the tree would make every recursive query hang. Block it at write time.
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

CREATE TRIGGER contexts_check_cycle
    BEFORE INSERT OR UPDATE OF parent_id ON contexts
    FOR EACH ROW EXECUTE FUNCTION contexts_prevent_cycle();

CREATE TRIGGER contexts_set_updated_at
    BEFORE UPDATE ON contexts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS contexts;
DROP FUNCTION IF EXISTS contexts_prevent_cycle();
DROP TABLE IF EXISTS users;
