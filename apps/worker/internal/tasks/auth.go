package tasks

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"

	"github.com/chiempham/warp-work/internal/auth"
)

// TypeSweepSessions removes sessions that can no longer authenticate anything.
const TypeSweepSessions = "auth:sweep_sessions"

// sessionGrace is how long a revoked or expired session stays readable before
// it is deleted, so "when did I sign out of that machine" survives a while.
const sessionGrace = 7 * 24 * time.Hour

// SweepSessionsPayload is empty today. It exists so adding a field later does
// not change the task's wire format from "no payload" to "a payload", which
// would strand anything already queued.
type SweepSessionsPayload struct{}

// NewSweepSessions builds the task. Scheduling it is the caller's business —
// asynq's periodic scheduler in the worker's main, not a cron on the host.
func NewSweepSessions() (*asynq.Task, error) {
	payload, err := json.Marshal(SweepSessionsPayload{})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeSweepSessions, payload), nil
}

// SweepSessions is the handler.
//
// This is the first thing the worker actually does, and the reason
// internal/auth lives at the repository root: apps/api/internal/... is
// importable only from apps/api, which the compiler enforces.
func SweepSessions(svc *auth.Service, logger *slog.Logger) asynq.HandlerFunc {
	return func(ctx context.Context, _ *asynq.Task) error {
		removed, err := svc.SweepExpired(ctx, sessionGrace)
		if err != nil {
			// Returned rather than swallowed: asynq retries, and a sweep that
			// silently stops working leaves the table growing unnoticed.
			return err
		}

		// Logged only when it did something, so a quiet system stays quiet.
		if removed > 0 {
			logger.InfoContext(ctx, "swept expired sessions",
				slog.Int64("removed", removed),
				slog.Duration("grace", sessionGrace))
		}
		return nil
	}
}
