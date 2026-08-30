-- End-of-session and periodic summaries.

-- +goose Up

CREATE TYPE report_kind AS ENUM ('session', 'daily', 'weekly');

CREATE TABLE reports (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    session_id   uuid        REFERENCES work_sessions (id) ON DELETE SET NULL,
    kind         report_kind NOT NULL,
    period_start timestamptz NOT NULL,
    period_end   timestamptz NOT NULL,
    content_md   text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT reports_period_order CHECK (period_end >= period_start),
    CONSTRAINT reports_session_kind CHECK (
        (kind = 'session' AND session_id IS NOT NULL)
        OR (kind <> 'session')
    )
);

CREATE INDEX reports_recent_idx ON reports (user_id, kind, period_start DESC);

-- +goose Down

DROP TABLE IF EXISTS reports;
DROP TYPE IF EXISTS report_kind;
