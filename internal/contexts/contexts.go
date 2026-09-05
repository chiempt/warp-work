// Package contexts owns the life-area tree — the axis every other record hangs
// off. Creating one is the only write that changes what the rest of the system
// can be filed under, so the rules live here rather than in a handler.
package contexts

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/chiempham/warp-work/internal/domain"
	"github.com/chiempham/warp-work/internal/store"
)

// Errors a caller is expected to handle. Anything else is a fault.
var (
	// ErrSlugTaken means this owner already has a context with that slug.
	// Slugs are what routing rules and saved links refer to, so they are
	// unique per owner and never silently suffixed.
	ErrSlugTaken = errors.New("a context with that slug already exists")

	// ErrNoParent means the requested parent does not exist, or belongs to
	// somebody else. Both are reported the same way: the caller has no
	// business knowing that another owner's context id is real.
	ErrNoParent = errors.New("no such parent context")
)

// Store is the data this package needs, declared by the consumer.
type Store interface {
	CreateContext(ctx context.Context, arg store.CreateContextParams) (store.Context, error)
	GetContext(ctx context.Context, id uuid.UUID) (store.Context, error)
	NextContextPosition(ctx context.Context, userID uuid.UUID) (int32, error)
	ListContexts(ctx context.Context, arg store.ListContextsParams) ([]store.Context, error)
}

var _ Store = (*store.Queries)(nil)

// Service is the context tree's write path.
type Service struct {
	store Store
}

func NewService(st Store) *Service { return &Service{store: st} }

// CreateParams is what creating a context needs. Slug and name are required;
// the schema has already rejected an empty or malformed one by the time this is
// called. Colour is optional — a context without one is shown in the neutral
// tone, which is a real choice rather than a missing value.
type CreateParams struct {
	Slug        string
	Name        string
	ParentID    *uuid.UUID
	Color       *string
	ToneProfile *string
}

// Create adds a context for one owner.
//
// The parent is checked here rather than left to the foreign key, for a reason
// the constraint cannot express: the key proves the row exists, not that it
// belongs to the caller. Without this check an owner could nest their context
// under somebody else's and quietly inherit its defaults.
func (s *Service) Create(ctx context.Context, userID uuid.UUID, p CreateParams) (store.Context, error) {
	// The contract already restricts colour to the enum, and the database
	// repeats it as contexts_color_token. Checked here too because this package
	// is callable from the worker and from tests, neither of which goes through
	// the generated server.
	if p.Color != nil {
		if err := domain.ContextColor(*p.Color).Valid(); err != nil {
			return store.Context{}, err
		}
	}

	if p.ParentID != nil {
		parent, err := s.store.GetContext(ctx, *p.ParentID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return store.Context{}, ErrNoParent
			}
			return store.Context{}, fmt.Errorf("read parent context: %w", err)
		}
		if parent.UserID != userID {
			return store.Context{}, ErrNoParent
		}
	}

	position, err := s.store.NextContextPosition(ctx, userID)
	if err != nil {
		return store.Context{}, fmt.Errorf("read next position: %w", err)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return store.Context{}, fmt.Errorf("new context id: %w", err)
	}

	row, err := s.store.CreateContext(ctx, store.CreateContextParams{
		ID:       id,
		UserID:   userID,
		ParentID: p.ParentID,
		Slug:     p.Slug,
		Name:     p.Name,
		Color:    p.Color,
		// The column defaults to '{}', meaning always active. Active hours are
		// set by editing the context, not by guessing at creation.
		ActiveHours: []byte("{}"),
		ToneProfile: p.ToneProfile,
		Position:    position,
	})
	if err != nil {
		if isUniqueViolation(err, "contexts_unique_slug") {
			return store.Context{}, ErrSlugTaken
		}
		return store.Context{}, fmt.Errorf("create context: %w", err)
	}

	return row, nil
}

// isUniqueViolation reports whether err is Postgres 23505 for a named
// constraint. Matched on the constraint rather than on the message text, which
// is localised and not part of any contract.
func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) &&
		pgErr.Code == "23505" &&
		pgErr.ConstraintName == constraint
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, includeArchived bool) ([]store.Context, error) {
	return s.store.ListContexts(ctx, store.ListContextsParams{
		UserID:          userID,
		IncludeArchived: includeArchived,
	})
}
