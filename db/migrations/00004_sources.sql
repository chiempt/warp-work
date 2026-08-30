-- +goose Up

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

-- Cheap deterministic routing, evaluated before any model call.
CREATE TABLE routing_rules (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id  uuid               NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    match_type  routing_match_type NOT NULL,
    -- Stored lowercase so matching never depends on how the sender typed it.
    match_value text               NOT NULL,
    priority    integer            NOT NULL DEFAULT 100,
    is_active   boolean            NOT NULL DEFAULT true,
    created_at  timestamptz        NOT NULL DEFAULT now(),
    updated_at  timestamptz        NOT NULL DEFAULT now(),

    CONSTRAINT routing_rules_value_lowercase CHECK (match_value = lower(match_value)),
    CONSTRAINT routing_rules_value_not_blank CHECK (length(btrim(match_value)) > 0),
    CONSTRAINT routing_rules_unique_match UNIQUE (context_id, match_type, match_value)
);

CREATE INDEX routing_rules_lookup_idx ON routing_rules (user_id, match_type, match_value)
    WHERE is_active = true;

CREATE TRIGGER routing_rules_set_updated_at
    BEFORE UPDATE ON routing_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everything from the outside world lands here, raw and unmodified.
-- Tasks, events and commitments are all derived from these rows.
CREATE TABLE signals (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id         uuid             NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    external_id        text             NOT NULL,
    external_thread_id text,
    kind               signal_kind      NOT NULL,
    direction          signal_direction NOT NULL DEFAULT 'inbound',
    subject            text,
    snippet            text,
    payload            jsonb            NOT NULL,
    -- SHA-256 hex of the normalised body, computed by the application.
    -- Used to skip re-extraction of content already seen on another channel.
    content_hash       text,
    occurred_at        timestamptz      NOT NULL,
    ingested_at        timestamptz      NOT NULL DEFAULT now(),
    processed_at       timestamptz,
    processing_error   text,

    CONSTRAINT signals_unique_external UNIQUE (account_id, external_id),
    CONSTRAINT signals_hash_format CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$')
);

-- The extraction worker's queue.
CREATE INDEX signals_unprocessed_idx ON signals (occurred_at)
    WHERE processed_at IS NULL;
CREATE INDEX signals_timeline_idx ON signals (account_id, occurred_at DESC);
CREATE INDEX signals_thread_idx ON signals (external_thread_id)
    WHERE external_thread_id IS NOT NULL;
CREATE INDEX signals_hash_idx ON signals (content_hash)
    WHERE content_hash IS NOT NULL;

-- Signals are append-only. Guard it in the database, not just in review.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION signals_protect_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.external_id IS DISTINCT FROM OLD.external_id
       OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at THEN
        RAISE EXCEPTION 'signals are immutable: payload, external_id and occurred_at cannot change'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER signals_immutable
    BEFORE UPDATE ON signals
    FOR EACH ROW EXECUTE FUNCTION signals_protect_payload();

-- Routing result. A signal can legitimately belong to more than one context.
CREATE TABLE signal_contexts (
    signal_id   uuid              NOT NULL REFERENCES signals (id) ON DELETE CASCADE,
    context_id  uuid              NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    confidence  numeric(4, 3)     NOT NULL DEFAULT 1.000,
    assigned_by assignment_source NOT NULL,
    created_at  timestamptz       NOT NULL DEFAULT now(),

    PRIMARY KEY (signal_id, context_id),
    CONSTRAINT signal_contexts_confidence_range CHECK (confidence BETWEEN 0 AND 1)
);

CREATE INDEX signal_contexts_context_idx ON signal_contexts (context_id);
-- Signals the router was unsure about, for the manual triage queue.
CREATE INDEX signal_contexts_low_confidence_idx ON signal_contexts (confidence)
    WHERE assigned_by = 'model' AND confidence < 0.700;

-- +goose Down

DROP TABLE IF EXISTS signal_contexts;
DROP TABLE IF EXISTS signals;
DROP FUNCTION IF EXISTS signals_protect_payload();
DROP TABLE IF EXISTS routing_rules;
DROP TABLE IF EXISTS account_contexts;
DROP TABLE IF EXISTS accounts;
