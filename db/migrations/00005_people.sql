-- Contacts, and the handles they are reachable at.
--
-- `people` are counterparties — the owner is deliberately not among them, or the
-- system could record that they owe themselves.

-- +goose Up

CREATE TYPE identity_provider AS ENUM ('email', 'phone', 'zalo', 'facebook', 'instagram', 'other');

CREATE TABLE people (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    display_name       text        NOT NULL,
    primary_context_id uuid        REFERENCES contexts (id) ON DELETE SET NULL,
    organisation       text,
    notes              text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_user_idx ON people (user_id);

CREATE INDEX people_name_trgm_idx ON people USING gin (display_name gin_trgm_ops);

CREATE TRIGGER people_set_updated_at
    BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The same human shows up as an email address, a Zalo id and a phone number.
-- This table is what lets the system say "these are all Hai".
CREATE TABLE identities (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    person_id   uuid              NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    provider    identity_provider NOT NULL,
    handle      citext            NOT NULL,
    is_verified boolean           NOT NULL DEFAULT false,
    created_at  timestamptz       NOT NULL DEFAULT now(),

    -- One handle resolves to exactly one person. Prevents silent identity splits.
    CONSTRAINT identities_unique_handle UNIQUE (user_id, provider, handle),
    CONSTRAINT identities_handle_not_blank CHECK (length(btrim(handle)) > 0)
);

CREATE INDEX identities_person_idx ON identities (person_id);

-- +goose Down

DROP TABLE IF EXISTS identities;
DROP TABLE IF EXISTS people;
DROP TYPE IF EXISTS identity_provider;
