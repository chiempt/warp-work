package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/chiempham/warp-work/internal/store"
)

// Store is everything this package needs from the database: the queries, plus
// a way to run several of them atomically.
//
// InTx lives on the interface rather than being a *pgxpool.Pool passed around,
// so a test can satisfy the whole thing without a database — and so no caller
// can start a transaction and forget to finish it.
type Store interface {
	Repository
	InTx(ctx context.Context, fn func(Repository) error) error
}

// PgxStore is the production implementation. It is the only place in this
// package that knows a connection pool exists.
type PgxStore struct {
	*store.Queries
	pool *pgxpool.Pool
}

var _ Store = (*PgxStore)(nil)

func NewPgxStore(pool *pgxpool.Pool) *PgxStore {
	return &PgxStore{Queries: store.New(pool), pool: pool}
}

// InTx runs fn inside one transaction, committing if it returns nil and rolling
// back otherwise.
//
// The deferred rollback is not redundant with the commit below it: it is what
// unwinds the transaction when fn panics, which no explicit path can cover.
// After a successful commit it fails with ErrTxClosed, which is why that one
// error is swallowed.
func (s *PgxStore) InTx(ctx context.Context, fn func(Repository) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			// Nothing useful to do here; the transaction is already unwound or
			// the connection is gone.
			_ = err
		}
	}()

	if err := fn(s.Queries.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
