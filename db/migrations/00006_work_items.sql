-- +goose Up

CREATE TABLE tasks (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id        uuid        NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    source_signal_id  uuid        REFERENCES signals (id) ON DELETE SET NULL,
    parent_task_id    uuid        REFERENCES tasks (id) ON DELETE CASCADE,
    title             text        NOT NULL,
    detail            text,
    status            task_status NOT NULL DEFAULT 'open',
    owner             task_owner  NOT NULL DEFAULT 'me',
    priority          smallint    NOT NULL DEFAULT 3,
    due_at            timestamptz,
    estimated_minutes integer,
    blocked_reason    text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    completed_at      timestamptz,

    CONSTRAINT tasks_title_not_blank  CHECK (length(btrim(title)) > 0),
    CONSTRAINT tasks_priority_range   CHECK (priority BETWEEN 1 AND 5),
    CONSTRAINT tasks_estimate_positive CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    CONSTRAINT tasks_no_self_parent   CHECK (parent_task_id IS DISTINCT FROM id),
    -- completed_at and status must agree, always.
    CONSTRAINT tasks_completion_consistent CHECK (
        (status = 'done' AND completed_at IS NOT NULL)
        OR (status <> 'done' AND completed_at IS NULL)
    ),
    CONSTRAINT tasks_blocked_has_reason CHECK (
        status <> 'blocked' OR blocked_reason IS NOT NULL
    )
);

-- The main board query: what is live in this context, soonest first.
CREATE INDEX tasks_live_idx ON tasks (context_id, due_at NULLS LAST, priority)
    WHERE status IN ('open', 'in_progress', 'blocked');
-- Agent work queue.
CREATE INDEX tasks_agent_queue_idx ON tasks (context_id, priority)
    WHERE owner = 'agent' AND status = 'open';
CREATE INDEX tasks_source_signal_idx ON tasks (source_signal_id);
CREATE INDEX tasks_parent_idx ON tasks (parent_task_id);

CREATE TRIGGER tasks_set_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id          uuid         NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    source_signal_id    uuid         REFERENCES signals (id) ON DELETE SET NULL,
    person_id           uuid         REFERENCES people (id) ON DELETE SET NULL,
    external_calendar_id text,
    external_event_id   text,
    title               text         NOT NULL,
    description         text,
    location            text,
    start_at            timestamptz  NOT NULL,
    end_at              timestamptz,
    all_day             boolean      NOT NULL DEFAULT false,
    status              event_status NOT NULL DEFAULT 'confirmed',
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT events_time_order CHECK (end_at IS NULL OR end_at >= start_at),
    CONSTRAINT events_external_pair CHECK (
        num_nonnulls(external_calendar_id, external_event_id) <> 1
    )
);

CREATE UNIQUE INDEX events_unique_external_idx
    ON events (external_calendar_id, external_event_id)
    WHERE external_event_id IS NOT NULL;

CREATE INDEX events_upcoming_idx ON events (start_at)
    WHERE status <> 'cancelled';
CREATE INDEX events_context_idx ON events (context_id, start_at);

CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Who owes what to whom. The highest-value table in the system: things get
-- dropped because they are forgotten, not because they are hard.
--
-- Note there is no 'overdue' status. Overdue is derived from due_at < now(),
-- never stored, so it can never go stale.
CREATE TABLE commitments (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid                 NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id         uuid                 NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    person_id          uuid                 REFERENCES people (id) ON DELETE SET NULL,
    evidence_signal_id uuid                 REFERENCES signals (id) ON DELETE SET NULL,
    direction          commitment_direction NOT NULL,
    what               text                 NOT NULL,
    status             commitment_status    NOT NULL DEFAULT 'open',
    promised_at        timestamptz          NOT NULL DEFAULT now(),
    due_at             timestamptz,
    resolved_at        timestamptz,
    -- Whether the extraction has been confirmed by the user. Until precision is
    -- measured, unconfirmed commitments should not drive reminders.
    is_confirmed       boolean              NOT NULL DEFAULT false,
    created_at         timestamptz          NOT NULL DEFAULT now(),
    updated_at         timestamptz          NOT NULL DEFAULT now(),

    CONSTRAINT commitments_what_not_blank CHECK (length(btrim(what)) > 0),
    CONSTRAINT commitments_resolution_consistent CHECK (
        (status = 'open' AND resolved_at IS NULL)
        OR (status <> 'open' AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX commitments_open_idx ON commitments (due_at NULLS LAST, direction)
    WHERE status = 'open';
CREATE INDEX commitments_person_idx ON commitments (person_id)
    WHERE status = 'open';
CREATE INDEX commitments_context_idx ON commitments (context_id, status);
CREATE INDEX commitments_unconfirmed_idx ON commitments (created_at)
    WHERE is_confirmed = false;

CREATE TRIGGER commitments_set_updated_at
    BEFORE UPDATE ON commitments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reminders point at exactly one of three targets. Rather than a polymorphic
-- target_id the database cannot check, three nullable columns with a strict
-- CHECK keep referential integrity intact.
CREATE TABLE reminders (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    task_id       uuid             REFERENCES tasks (id) ON DELETE CASCADE,
    event_id      uuid             REFERENCES events (id) ON DELETE CASCADE,
    commitment_id uuid             REFERENCES commitments (id) ON DELETE CASCADE,
    remind_at     timestamptz      NOT NULL,
    channel       reminder_channel NOT NULL DEFAULT 'app',
    status        reminder_status  NOT NULL DEFAULT 'scheduled',
    body          text,
    attempts      smallint         NOT NULL DEFAULT 0,
    sent_at       timestamptz,
    last_error    text,
    created_at    timestamptz      NOT NULL DEFAULT now(),

    CONSTRAINT reminders_exactly_one_target CHECK (
        num_nonnulls(task_id, event_id, commitment_id) = 1
    ),
    CONSTRAINT reminders_attempts_sane CHECK (attempts >= 0 AND attempts <= 10)
);

-- The dispatcher's only query.
CREATE INDEX reminders_due_idx ON reminders (remind_at)
    WHERE status = 'scheduled';
CREATE INDEX reminders_task_idx ON reminders (task_id);
CREATE INDEX reminders_event_idx ON reminders (event_id);
CREATE INDEX reminders_commitment_idx ON reminders (commitment_id);

-- Generic numeric series, serving the sport and fitness contexts.
CREATE TABLE metrics (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    context_id  uuid          NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
    metric      text          NOT NULL,
    value       numeric(12,3) NOT NULL,
    unit        text          NOT NULL,
    source      metric_source NOT NULL DEFAULT 'manual',
    note        text,
    recorded_at timestamptz   NOT NULL DEFAULT now(),
    created_at  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT metrics_metric_format CHECK (metric ~ '^[a-z0-9][a-z0-9_]*$')
);

CREATE INDEX metrics_series_idx ON metrics (context_id, metric, recorded_at DESC);

-- +goose Down

DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS commitments;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS tasks;
