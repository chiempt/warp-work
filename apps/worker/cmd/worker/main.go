// Command worker runs Warp's background work: adapters, the router, the
// extractor, the orchestrator, and the executor.
//
// Agents run here and only inside an open work session. Nothing in this process
// sends anything outward except through the executor, which reads approved
// proposed_actions — see CLAUDE.md, hard invariant 3.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"

	"github.com/chiempham/warp-work/apps/worker/internal/tasks"
	"github.com/chiempham/warp-work/internal/auth"
	"github.com/chiempham/warp-work/internal/config"
	"github.com/chiempham/warp-work/internal/platform/logging"
	"github.com/chiempham/warp-work/internal/platform/postgres"
	"github.com/chiempham/warp-work/internal/platform/queue"
)

func main() {
	if err := run(); err != nil {
		logging.Fallback().Error("worker exited", slog.String("error", err.Error()))
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

	// The worker refuses to start against a database it is ahead of. A handler
	// running against a schema that lacks its columns fails one job at a time,
	// silently, which is far worse than not starting.
	state, err := postgres.CheckSchema(ctx, pool)
	if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	if !state.UpToDate() {
		return fmt.Errorf("database is at migration %d but this binary expects %d; run `make migrate-up`",
			state.Applied, state.Embedded)
	}

	redisOpt, err := asynq.ParseRedisURI(cfg.Redis.URL)
	if err != nil {
		return fmt.Errorf("parse REDIS_URL: %w", err)
	}

	server := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: cfg.Redis.Concurrency,
		Logger:      queue.NewLogger(logger),
		Queues:      tasks.Weights(),
		BaseContext: func() context.Context { return logging.Into(context.Background(), logger) },
		ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, t *asynq.Task, err error) {
			// The payload is not logged: it identifies accounts and signals.
			logger.ErrorContext(ctx, "task failed",
				slog.String("type", t.Type()),
				slog.String("error", err.Error()))
		}),
	})

	authSvc := auth.NewService(auth.NewPgxStore(pool), nil)

	mux := asynq.NewServeMux()
	registerHandlers(mux, authSvc, logger)

	// The scheduler enqueues periodic work; the server above executes it.
	// Separating them is what lets several workers run without each of them
	// enqueueing the same job.
	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{
		Logger:   queue.NewLogger(logger),
		Location: time.UTC,
	})
	if err := registerSchedule(scheduler); err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		logger.Info("worker draining")
		scheduler.Shutdown()
		server.Shutdown()
	}()

	go func() {
		if err := scheduler.Run(); err != nil {
			logger.Error("scheduler stopped", slog.String("error", err.Error()))
		}
	}()

	logger.Info("worker starting",
		slog.Int("concurrency", cfg.Redis.Concurrency),
		slog.String("env", string(cfg.Env)))

	if err := server.Run(mux); err != nil {
		return fmt.Errorf("run: %w", err)
	}
	return nil
}

// registerHandlers is the single place a background job becomes reachable.
//
// Phase 1 handlers (account sync, signal routing) attach here once the Gmail
// and Calendar adapters exist. A task type with no handler is left in its queue
// rather than being dropped, so registering late is safe.
func registerHandlers(mux *asynq.ServeMux, authSvc *auth.Service, logger *slog.Logger) {
	mux.Handle(tasks.TypeSweepSessions, tasks.SweepSessions(authSvc, logger))
}

// registerSchedule declares the periodic work. Cron lines live here rather than
// in the host's crontab so the schedule ships with the binary that serves it.
func registerSchedule(scheduler *asynq.Scheduler) error {
	sweep, err := tasks.NewSweepSessions()
	if err != nil {
		return fmt.Errorf("build session sweep task: %w", err)
	}

	// Daily, a little after midnight UTC. Nothing depends on the exact time;
	// what matters is that it is not on the hour, where everything else is.
	if _, err := scheduler.Register("17 0 * * *", sweep,
		asynq.Queue(tasks.QueueBackfill), asynq.MaxRetry(3)); err != nil {
		return fmt.Errorf("schedule session sweep: %w", err)
	}
	return nil
}
