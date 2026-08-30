-- The gap between what an agent proposed and what actually left the system.
--
-- Nothing reaches the outside world except through these two tables.

-- +goose Up

CREATE TYPE proposed_action_status AS ENUM ('pending', 'approved', 'edited', 'rejected', 'expired');

CREATE TYPE execution_result AS ENUM ('success', 'failed');

-- The gate. Nothing reaches the outside world without a row here first.
CREATE TABLE proposed_actions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id           uuid                  NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    action_type_code text                  NOT NULL REFERENCES action_types (code) ON DELETE RESTRICT,
    payload          jsonb                 NOT NULL,
    -- What the user changed before approving. The difference between payload and
    -- payload_edited is the most valuable training signal the system produces.
    payload_edited   jsonb,
    status           proposed_action_status NOT NULL DEFAULT 'pending',
    review_note      text,
    reviewed_at      timestamptz,
    expires_at       timestamptz,
    created_at       timestamptz           NOT NULL DEFAULT now(),

    CONSTRAINT proposed_actions_review_consistent CHECK (
        (status = 'pending' AND reviewed_at IS NULL)
        OR (status <> 'pending' AND reviewed_at IS NOT NULL)
    ),
    -- 'edited' means the user changed something; anything else means they did not.
    CONSTRAINT proposed_actions_edit_consistent CHECK (
        (status = 'edited' AND payload_edited IS NOT NULL)
        OR (status <> 'edited' AND payload_edited IS NULL)
    )
);

CREATE INDEX proposed_actions_queue_idx ON proposed_actions (created_at)
    WHERE status = 'pending';

CREATE INDEX proposed_actions_run_idx ON proposed_actions (run_id);

CREATE INDEX proposed_actions_expiring_idx ON proposed_actions (expires_at)
    WHERE status = 'pending' AND expires_at IS NOT NULL;

-- What actually happened. One row per proposed action, at most.
CREATE TABLE executions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_action_id  uuid             NOT NULL UNIQUE
                            REFERENCES proposed_actions (id) ON DELETE CASCADE,
    result              execution_result NOT NULL,
    -- Provider-side identifier of the thing created: message id, event id.
    external_ref        text,
    -- Whatever the undo path needs: a draft id to delete, an event id to cancel.
    undo_token          text,
    undone_at           timestamptz,
    error               text,
    executed_at         timestamptz      NOT NULL DEFAULT now(),

    CONSTRAINT executions_failure_has_error CHECK (result <> 'failed' OR error IS NOT NULL),
    CONSTRAINT executions_undo_needs_token CHECK (undone_at IS NULL OR undo_token IS NOT NULL)
);

CREATE INDEX executions_recent_idx ON executions (executed_at DESC);

CREATE INDEX executions_undoable_idx ON executions (executed_at DESC)
    WHERE undo_token IS NOT NULL AND undone_at IS NULL;

-- +goose Down

DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS proposed_actions;
DROP TYPE IF EXISTS execution_result;
DROP TYPE IF EXISTS proposed_action_status;
