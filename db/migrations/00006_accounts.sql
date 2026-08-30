-- Connected sources of signals, and which contexts each feeds.
--
-- One Google account produces three rows here: gmail, gcalendar, gdrive.

-- +goose Up

CREATE TYPE account_provider AS ENUM (
    'gmail', 'gcalendar', 'gdrive',
    'zalo_oa', 'facebook_page', 'instagram_business',
    'manual'
);

CREATE TYPE account_reliability AS ENUM ('official', 'unofficial', 'manual');

CREATE TYPE account_status AS ENUM ('active', 'needs_reauth', 'disabled', 'error');

CREATE TABLE accounts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider            account_provider   NOT NULL,
    reliability         account_reliability NOT NULL,
    display_name        text               NOT NULL,
    -- Provider-side account identifier: the mailbox address, the OA id, etc.
    external_account_id text,
    -- Encrypted at the application layer. Never store plaintext tokens here.
    credentials_enc     bytea,
    scopes              text[]             NOT NULL DEFAULT '{}',
    -- Incremental sync position: Gmail historyId, Calendar syncToken, and so on.
    sync_cursor         jsonb              NOT NULL DEFAULT '{}'::jsonb,
    status              account_status     NOT NULL DEFAULT 'active',
    last_sync_at        timestamptz,
    last_error          text,
    created_at          timestamptz        NOT NULL DEFAULT now(),
    updated_at          timestamptz        NOT NULL DEFAULT now(),

    -- Manual sources have no credentials; every other provider must have them.
    CONSTRAINT accounts_manual_has_no_creds CHECK (
        provider <> 'manual' OR credentials_enc IS NULL
    )
);

CREATE UNIQUE INDEX accounts_unique_external_idx
    ON accounts (user_id, provider, external_account_id)
    WHERE external_account_id IS NOT NULL;

CREATE INDEX accounts_due_for_sync_idx ON accounts (last_sync_at NULLS FIRST)
    WHERE status = 'active';

CREATE TRIGGER accounts_set_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One account can feed several contexts; the router decides per signal.
CREATE TABLE account_contexts (
    account_id uuid        NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    context_id uuid        NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, context_id)
);

CREATE INDEX account_contexts_context_idx ON account_contexts (context_id);

-- +goose Down

DROP TABLE IF EXISTS account_contexts;
DROP TABLE IF EXISTS accounts;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS account_reliability;
DROP TYPE IF EXISTS account_provider;
