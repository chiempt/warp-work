// Package logging builds the one structured logger the process uses. There is
// no package-level logger: it is constructed in main and injected.
package logging

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/lmittmann/tint"
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

// Format values, matching config.Log.Format. Kept as plain strings so this
// package stays free of config — it is imported by everything, including the
// fallback path that runs before configuration has been parsed.
const (
	FormatJSON    = "json"
	FormatConsole = "console"
)

// New returns the process logger at the given level.
//
// JSON is the real output: one event per line, greppable, and the shape every
// collector downstream expects. Console is a concession to a person watching a
// terminal — same events, same fields, coloured and aligned — and it is never
// the default outside development.
//
// Signal payloads, credentials, and draft content are never logged above debug
// — they are other people's correspondence. See docs/conventions.md §5.
func New(level, format string) *slog.Logger {
	if format == FormatConsole {
		return slog.New(consoleHandler(os.Stdout, parseLevel(level)))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:       parseLevel(level),
		ReplaceAttr: UTCTimestamps,
	}))
}

// consoleHandler is the human-facing format: a wall-clock time, a coloured
// level, the message, then the attributes.
//
// The timestamp stays UTC here as well. A developer reading `09:27:05` and a
// production line reading `09:27:05Z` are describing the same instant, and the
// moment those two disagree is the moment someone correlates an incident wrong.
func consoleHandler(w io.Writer, level slog.Level) slog.Handler {
	return tint.NewHandler(w, &tint.Options{
		Level:      level,
		TimeFormat: time.TimeOnly,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			return UTCTimestamps(groups, a)
		},
	})
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
//
// It writes the console format when stderr is a terminal and JSON otherwise:
// the failure it reports is usually a missing variable being read by the person
// who forgot it, but the same line has to be machine-readable when it is not.
func Fallback() *slog.Logger {
	if isTerminal(os.Stderr) {
		return slog.New(consoleHandler(os.Stderr, slog.LevelInfo))
	}
	return slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		ReplaceAttr: UTCTimestamps,
	}))
}

// isTerminal reports whether f is attached to a terminal rather than a pipe or
// a file. A character device is the portable-enough signal, and being wrong
// only costs colour.
func isTerminal(f *os.File) bool {
	info, err := f.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
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
