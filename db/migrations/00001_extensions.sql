-- Extensions and the shared updated_at trigger.
--
-- Infrastructure every other module depends on. Nothing domain-specific belongs here.

-- +goose Up

CREATE EXTENSION IF NOT EXISTS vector;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Keeps updated_at honest. Attached to every table that carries the column.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

-- +goose Down

-- The extensions are deliberately not dropped.
--
-- `vector` is not a trusted extension, so it is installed by a superuser in
-- `make db-create`; the migration role does not own it and cannot drop it.
-- Dropping the others would also reach beyond this schema — they are database
-- wide, and another schema in the same database may depend on them.
DROP FUNCTION IF EXISTS set_updated_at();
