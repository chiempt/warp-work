// Package postgres owns the connection pool. It knows nothing about Warp's
// entities — queries live in generated code under internal/store.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"net"
	"syscall"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgxvec "github.com/pgvector/pgvector-go/pgx"

	"github.com/chiempham/warp-work/internal/config"
)

// Pool is the process-wide connection pool.
type Pool = pgxpool.Pool

// Connect builds the pool and verifies it can reach the database. It does not
// apply migrations — that is an operator action.
func Connect(ctx context.Context, cfg config.Postgres) (*Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MaxConnIdleTime = cfg.MaxConnIdle

	// pgvector's types are not built into pgx: every connection has to learn
	// them, or reading memory_notes.embedding fails at runtime rather than at
	// startup. The pool creates connections lazily, so this must be a hook.
	poolCfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		return pgxvec.RegisterTypes(ctx, conn)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		if isUnreachable(err) {
			return nil, fmt.Errorf("cannot reach Postgres at %s: %w\n\thint: start it, or run `make setup` if this machine has not been provisioned", redactedTarget(poolCfg), err)
		}
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

// isUnreachable distinguishes "nothing is listening" from a real database
// error, so the hint is only offered when it applies.
func isUnreachable(err error) bool {
	if errors.Is(err, syscall.ECONNREFUSED) || errors.Is(err, syscall.EHOSTUNREACH) {
		return true
	}
	var netErr *net.OpError
	return errors.As(err, &netErr)
}

// redactedTarget names the host and port without the credentials, so the hint
// can be logged.
func redactedTarget(cfg *pgxpool.Config) string {
	c := cfg.ConnConfig
	return fmt.Sprintf("%s:%d/%s", c.Host, c.Port, c.Database)
}
