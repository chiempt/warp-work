-- The immutable record of everything that arrived, and where it was filed.
--
-- Tasks, events and commitments are all derived from these rows, so nothing here
-- may be rewritten.

-- +goose Up

CREATE TYPE assignment_source AS ENUM ('rule', 'model', 'manual');

CREATE TYPE signal_kind AS ENUM ('email', 'message', 'calendar_event', 'file', 'note');

CREATE TYPE signal_direction AS ENUM ('inbound', 'outbound', 'internal');

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
DROP TYPE IF EXISTS signal_direction;
DROP TYPE IF EXISTS signal_kind;
DROP TYPE IF EXISTS assignment_source;
