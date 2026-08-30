// Package queue adapts asynq to the rest of the process.
package queue

import (
	"context"
	"fmt"
	"log/slog"
)

// Logger routes asynq's own output through slog, so every line the worker emits
// is JSON with the same fields. Without this the process produces two log
// formats and only one of them is greppable.
type Logger struct {
	logger *slog.Logger
}

// NewLogger wraps l for asynq. It tags every line so asynq's chatter can be
// filtered out separately from Warp's.
func NewLogger(l *slog.Logger) *Logger {
	return &Logger{logger: l.With(slog.String("component", "asynq"))}
}

func (l *Logger) Debug(args ...any) { l.log(slog.LevelDebug, args) }
func (l *Logger) Info(args ...any)  { l.log(slog.LevelInfo, args) }
func (l *Logger) Warn(args ...any)  { l.log(slog.LevelWarn, args) }
func (l *Logger) Error(args ...any) { l.log(slog.LevelError, args) }

// Fatal is asynq's unrecoverable path. It logs at error level and returns:
// terminating the process is main's decision, not a library's.
func (l *Logger) Fatal(args ...any) { l.log(slog.LevelError, args) }

func (l *Logger) log(level slog.Level, args []any) {
	l.logger.Log(context.Background(), level, fmt.Sprint(args...))
}
