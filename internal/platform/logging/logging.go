// Package logging builds the one structured logger the process uses. There is
// no package-level logger: it is constructed in main and injected.
package logging

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

// Field names that must appear on every log line that has them, so a run can be
// followed across the api and the worker.
const (
	FieldContextID = "context_id"
	FieldSessionID = "session_id"
	FieldRunID     = "run_id"
	FieldAccountID = "account_id"
	FieldSignalID  = "signal_id"
	FieldRequestID = "request_id"
)

// New returns a JSON logger at the given level.
//
// Signal payloads, credentials, and draft content are never logged above debug
// — they are other people's correspondence. See docs/conventions.md §5.
func New(level string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:       parseLevel(level),
		ReplaceAttr: UTCTimestamps,
	})
	return slog.New(handler)
}

// UTCTimestamps forces log times to UTC. Warp stores and reasons in UTC
// everywhere; a log line in the machine's local zone is the one place that
// convention silently breaks, and it breaks exactly when correlating an
// incident across services.
func UTCTimestamps(_ []string, a slog.Attr) slog.Attr {
	if a.Key == slog.TimeKey && a.Value.Kind() == slog.KindTime {
		a.Value = slog.TimeValue(a.Value.Time().UTC())
	}
	return a
}

func parseLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// Fallback is the logger used before configuration has been parsed — the one
// place a startup failure can still be reported. It obeys the same UTC rule as
// New, so a crash line and a request line can be read side by side.
func Fallback() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		ReplaceAttr: UTCTimestamps,
	}))
}

type ctxKey struct{}

// Into returns a context carrying the logger, for the places where threading it
// explicitly is impractical — middleware and asynq handlers.
func Into(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

// From returns the logger carried by ctx, or a discarding logger. It never
// returns nil, so callers do not have to guard.
func From(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok && l != nil {
		return l
	}
	return slog.New(slog.DiscardHandler)
}
