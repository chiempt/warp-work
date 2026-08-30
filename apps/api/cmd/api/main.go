// Command api serves Warp's HTTP API.
//
// It does not run background work and it does not apply migrations. Agents run
// in the worker, inside a work session; migrations are an operator action.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/chiempham/warp-work/apps/api/internal/httpapi"
	"github.com/chiempham/warp-work/internal/config"
	"github.com/chiempham/warp-work/internal/platform/logging"
	"github.com/chiempham/warp-work/internal/platform/postgres"
)

func main() {
	if err := run(); err != nil {
		// Configuration may have failed before a configured logger existed.
		logging.Fallback().Error("api exited", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := logging.New(cfg.Log.Level, cfg.Log.Format)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := postgres.Connect(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer pool.Close()

	// Report the schema gap once at startup so it appears in the logs, not only
	// in a readiness probe nobody is watching.
	if state, err := postgres.CheckSchema(ctx, pool); err != nil {
		logger.Warn("could not read schema version", slog.String("error", err.Error()))
	} else if !state.UpToDate() {
		logger.Warn("database schema is behind this binary; run `make migrate-up`",
			slog.Int64("applied", state.Applied),
			slog.Int64("expected", state.Embedded))
	}

	if !cfg.Claude.Enabled() {
		logger.Info("no Anthropic API key configured; model-backed features are unavailable")
	}

	server, err := httpapi.New(cfg, logger, pool)
	if err != nil {
		return err
	}
	return server.Start(ctx)
}
