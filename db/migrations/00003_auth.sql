-- How the owner proves it is them.
--
-- Deliberately separate from two tables it is easy to confuse this with:
--
--   * `accounts` is a *source of signals* — a mailbox, a calendar, a Zalo OA.
--     One Google account produces three of those rows. Attaching sign-in to a
--     data source would mean disconnecting Gmail locks you out.
--   * `identities` is a *contact's* handles, hanging off `people`. The owner is
--     not a person: `people` are the counterparties in `commitments`, and
--     putting yourself there lets the system record that you owe yourself.
--
-- And `work_sessions` is the clock-in, not an HTTP session.
--
-- See docs/decisions/0008-authentication.md.

-- +goose Up

-- How the owner can sign in. `google` is the one implemented first; the others
-- are here so adding one later is a row, not an ALTER TYPE in its own
-- no-transaction migration.
--
-- Note that Zalo Login and Facebook Login are products distinct from their
-- messaging APIs: signing in with Zalo still does not make Zalo personal
-- messages readable. See the connector reality table in the context document.
-- Named `_kind` to match the rest of the schema — `contexts.kind` is a
-- `context_kind`, `signals.kind` a `signal_kind` — and because `auth_provider`
-- alone would collide with the table below once sqlc singularises it into a Go
-- struct. Postgres keeps tables and types in separate namespaces; Go does not.
CREATE TYPE auth_provider_kind AS ENUM ('google', 'zalo', 'facebook', 'passkey');

-- One row per way the owner can get in.
--
-- The table is plural by force as well as by convention: the singular name is
-- already taken by the enum above, and a table and a type cannot share a name.
--
-- A table rather than columns on `users` because a single way in is a single
-- point of lockout: lose the Google account and you are shut out of your own
-- system, with no administrator to appeal to. A second row is the recovery
-- path.
CREATE TABLE auth_providers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind          auth_provider_kind NOT NULL,
    -- The provider's immutable identifier — Google's `sub` claim, a passkey's
    -- credential id. Never the email: an email can be changed at the provider,
    -- and matching on it would hand the account to whoever inherits the address.
    subject       text          NOT NULL,
    -- What the provider reported. Informational and display-only: it can differ
    -- per provider, it can change, and a passkey or Zalo identity has none.
    -- user_profiles.email remains the canonical one.
    email         citext,
    is_primary    boolean       NOT NULL DEFAULT false,
    linked_at     timestamptz   NOT NULL DEFAULT now(),
    last_login_at timestamptz,

    CONSTRAINT auth_providers_subject_not_blank CHECK (length(btrim(subject)) > 0),
    -- One identity at one provider belongs to at most one user.
    CONSTRAINT auth_providers_unique UNIQUE (kind, subject)
);

CREATE INDEX auth_providers_user_idx ON auth_providers (user_id);

-- At most one primary per user.
CREATE UNIQUE INDEX auth_providers_one_primary_idx
    ON auth_providers (user_id) WHERE is_primary;

-- +goose StatementBegin
-- Removing the last way in is an unrecoverable lockout, so the database refuses
-- it rather than trusting every future code path to remember. Same reasoning as
-- the immutability trigger on `signals`.
CREATE FUNCTION auth_providers_keep_one() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- The user row itself going away takes its providers with it; that is a
    -- deliberate account deletion, not a lockout.
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RETURN OLD;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth_providers
        WHERE user_id = OLD.user_id AND id <> OLD.id
    ) THEN
        RAISE EXCEPTION 'cannot unlink the last sign-in method for user %', OLD.user_id
            USING ERRCODE = 'restrict_violation',
                  HINT = 'link another provider first';
    END IF;

    RETURN OLD;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER auth_providers_keep_one
    BEFORE DELETE ON auth_providers
    FOR EACH ROW EXECUTE FUNCTION auth_providers_keep_one();

-- Where the owner is currently signed in.
--
-- Server-side and revocable on purpose. A stateless token cannot be withdrawn:
-- a lost laptop would mean waiting out the expiry or rotating the signing key
-- for everything.
CREATE TABLE auth_sessions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Which way in produced this session. Nullable so unlinking a provider
    -- does not erase the record of sessions it opened.
    auth_provider_id uuid        REFERENCES auth_providers (id) ON DELETE SET NULL,
    -- A hash of the session token, never the token. A database dump must not
    -- be enough to sign in.
    token_hash       bytea       NOT NULL,
    issued_at        timestamptz NOT NULL DEFAULT now(),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    revoked_at       timestamptz,
    -- Enough to recognise a session in a list and revoke the right one.
    user_agent       text        NOT NULL DEFAULT '',
    ip               inet,

    CONSTRAINT auth_sessions_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT auth_sessions_expires_after_issue CHECK (expires_at > issued_at)
);

-- The lookup on every authenticated request.
CREATE INDEX auth_sessions_live_idx ON auth_sessions (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;

-- Sweeping expired sessions.
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at);

-- +goose Down

DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_providers;
DROP FUNCTION IF EXISTS auth_providers_keep_one();
DROP TYPE IF EXISTS auth_provider_kind;
