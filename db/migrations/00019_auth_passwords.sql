-- Password credentials, kept out of `auth_providers` on purpose.
--
-- `auth_providers` holds no secrets, which is what makes `SELECT *` from it safe
-- to serialise straight into `GET /auth/providers`. Put the hash there and one
-- careless star leaks it.

-- +goose Up

-- Needed so `auth_passwords` can point at a provider *and* assert its kind in
-- the same foreign key.
ALTER TABLE auth_providers
    ADD CONSTRAINT auth_providers_id_kind_unique UNIQUE (id, kind);

CREATE TABLE auth_passwords (
    auth_provider_id uuid PRIMARY KEY,
    -- Carried so the composite foreign key below can pin it. Never anything
    -- but 'password'.
    kind             auth_provider_kind NOT NULL DEFAULT 'password',
    -- argon2id, in the standard encoded form that carries its own parameters:
    -- $argon2id$v=19$m=...,t=...,p=...$salt$hash. Storing the parameters with
    -- the hash is what makes them tunable later without invalidating old ones.
    hash             text        NOT NULL,
    -- Counted here rather than in Redis: a lockout that evaporates when the
    -- cache restarts is not a lockout.
    failed_attempts  smallint    NOT NULL DEFAULT 0,
    locked_until     timestamptz,
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT auth_passwords_kind_check   CHECK (kind = 'password'),
    CONSTRAINT auth_passwords_hash_format  CHECK (hash LIKE '$argon2id$%'),
    CONSTRAINT auth_passwords_attempts_sane CHECK (failed_attempts >= 0),

    -- A password row can only ever attach to a provider whose kind is
    -- 'password'. Declarative, so no code path can create a Google identity
    -- with a password hash bolted on.
    CONSTRAINT auth_passwords_provider_fkey
        FOREIGN KEY (auth_provider_id, kind)
        REFERENCES auth_providers (id, kind) ON DELETE CASCADE
);

CREATE TRIGGER auth_passwords_set_updated_at
    BEFORE UPDATE ON auth_passwords
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TABLE IF EXISTS auth_passwords;
ALTER TABLE auth_providers DROP CONSTRAINT IF EXISTS auth_providers_id_kind_unique;
