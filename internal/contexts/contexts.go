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

	// ErrNotFound means no such context, or it is not this owner's. Reported
	// identically for the same reason as ErrNoParent.
	ErrNotFound = errors.New("no such context")

	// ErrSelfParent and ErrCycle are the two ways a re-nest can fold the tree
	// onto itself. Separated because the fix differs: one is a mistaken click,
	// the other means the whole subtree has to move first.
	ErrSelfParent = errors.New("a context cannot be its own parent")
	ErrCycle      = errors.New("a context cannot be nested under its own descendant")

	// ErrTooDeep means the move would push the tree past the three levels the
	// contexts_prevent_cycle trigger allows.
	ErrTooDeep = errors.New("context nested deeper than three levels")
)

// LiveChildrenError refuses to archive a context out from under its children.
//
// It carries the count rather than being a bare sentinel because the owner's
// next question is always "how many?", and answering it costs one integer that
// the query already had to compute.
type LiveChildrenError struct {
	Count int32
}

func (e *LiveChildrenError) Error() string {
	return fmt.Sprintf("context still has %d live child context(s)", e.Count)
}

// Store is the data this package needs, declared by the consumer.
type Store interface {
	CreateContext(ctx context.Context, arg store.CreateContextParams) (store.Context, error)
	GetContext(ctx context.Context, id uuid.UUID) (store.Context, error)
	NextContextPosition(ctx context.Context, userID uuid.UUID) (int32, error)
	ListContexts(ctx context.Context, arg store.ListContextsParams) ([]store.Context, error)
	UpdateContext(ctx context.Context, arg store.UpdateContextParams) (store.Context, error)
	ArchiveContext(ctx context.Context, arg store.ArchiveContextParams) (store.Context, error)
	CountLiveChildren(ctx context.Context, parentID *uuid.UUID) (int32, error)
	IsDescendant(ctx context.Context, arg store.IsDescendantParams) (bool, error)
}

var _ Store = (*store.Queries)(nil)

// Service is the context tree's read and write path. Every rule that a
// constraint cannot express lives here, and the handlers hold no other door to
// context data.
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

// isCheckViolation reports whether err is Postgres 23514. The cycle trigger
// raises it with that SQLSTATE deliberately, so a rule enforced in PL/pgSQL
// arrives looking like every other constraint rather than as a bare exception.
func isCheckViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23514"
}

// List returns the owner's tree, parents before children then by position.
//
// The ordering is the query's, not this function's — see ListContexts in
// db/queries/contexts.sql. Sorting again here would be a second answer to a
// question already answered.
func (s *Service) List(ctx context.Context, userID uuid.UUID, includeArchived bool) ([]store.Context, error) {
	rows, err := s.store.ListContexts(ctx, store.ListContextsParams{
		UserID:          userID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("list contexts: %w", err)
	}
	return rows, nil
}

// Get returns one context the owner owns.
//
// The ownership check is here rather than in the query because the answer to
// "somebody else's id" must be the same as the answer to "no such id". A query
// scoped by user_id would give that for free, but GetContext is also how the
// parent check in Create reads a row it does not yet know the owner of.
func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (store.Context, error) {
	row, err := s.store.GetContext(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.Context{}, ErrNotFound
		}
		return store.Context{}, fmt.Errorf("read context: %w", err)
	}
	if row.UserID != userID {
		return store.Context{}, ErrNotFound
	}
	return row, nil
}

// UpdateParams is a partial change. Each nullable field takes a value and a
// Set flag, because "not mentioned" and "explicitly cleared" are different
// requests and a pointer alone cannot tell them apart.
type UpdateParams struct {
	Name           *string
	IsArchived     *bool
	SetColor       bool
	Color          *string
	SetParentID    bool
	ParentID       *uuid.UUID
	SetToneProfile bool
	ToneProfile    *string
}

// Update changes a context.
//
// Everything that can be checked before the write is checked before the write,
// so the common failures come back as their own errors instead of as one
// undifferentiated constraint violation. Only the depth cap is left to the
// trigger: it is the one rule that depends on rows this function has not read.
func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, p UpdateParams) (store.Context, error) {
	if p.SetColor && p.Color != nil {
		if err := domain.ContextColor(*p.Color).Valid(); err != nil {
			return store.Context{}, err
		}
	}

	// Establishes both that the context exists and that it is the caller's,
	// before anything below can leak the difference.
	if _, err := s.Get(ctx, userID, id); err != nil {
		return store.Context{}, err
	}

	if p.SetParentID && p.ParentID != nil {
		if err := s.checkNewParent(ctx, userID, id, *p.ParentID); err != nil {
			return store.Context{}, err
		}
	}

	// Archiving through Update is archiving, and answers to the same rule as
	// the DELETE endpoint. Without this the refusal would be one HTTP verb away
	// from being bypassed.
	if p.IsArchived != nil && *p.IsArchived {
		if err := s.checkNoLiveChildren(ctx, id); err != nil {
			return store.Context{}, err
		}
	}

	row, err := s.store.UpdateContext(ctx, store.UpdateContextParams{
		ID:             id,
		UserID:         userID,
		Name:           p.Name,
		IsArchived:     p.IsArchived,
		SetColor:       p.SetColor,
		Color:          p.Color,
		SetParentID:    p.SetParentID,
		ParentID:       p.ParentID,
		SetToneProfile: p.SetToneProfile,
		ToneProfile:    p.ToneProfile,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.Context{}, ErrNotFound
		}
		// The trigger raises check_violation for the depth cap. The cycle case
		// it also raises for was ruled out above, so this is the depth.
		if isCheckViolation(err) {
			return store.Context{}, ErrTooDeep
		}
		return store.Context{}, fmt.Errorf("update context: %w", err)
	}
	return row, nil
}

// Archive puts a context away without deleting anything.
//
// There is no delete. signals, tasks, events, commitments, metrics and
// memory_notes all reference contexts with ON DELETE CASCADE, so removing the
// row would take the life area's whole history with it.
//
// Idempotent: archiving an archived context succeeds, because the caller asked
// for a state and that state holds.
func (s *Service) Archive(ctx context.Context, userID, id uuid.UUID) error {
	if _, err := s.Get(ctx, userID, id); err != nil {
		return err
	}
	if err := s.checkNoLiveChildren(ctx, id); err != nil {
		return err
	}

	if _, err := s.store.ArchiveContext(ctx, store.ArchiveContextParams{
		ID:     id,
		UserID: userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("archive context: %w", err)
	}
	return nil
}

// checkNewParent rejects the three ways a re-nest can be wrong before the
// database has to. Depth is not among them — that one needs the whole ancestor
// chain, which the trigger already walks.
func (s *Service) checkNewParent(ctx context.Context, userID, id, parentID uuid.UUID) error {
	if parentID == id {
		return ErrSelfParent
	}

	parent, err := s.store.GetContext(ctx, parentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoParent
		}
		return fmt.Errorf("read parent context: %w", err)
	}
	if parent.UserID != userID {
		return ErrNoParent
	}

	// Moving a context under its own descendant would detach the subtree from
	// the tree entirely: the loop would still satisfy every foreign key, and
	// the recursive walk in context_tree would never reach it.
	inSubtree, err := s.store.IsDescendant(ctx, store.IsDescendantParams{
		CandidateID: parentID,
		RootID:      id,
	})
	if err != nil {
		return fmt.Errorf("check descendant: %w", err)
	}
	if inSubtree {
		return ErrCycle
	}
	return nil
}

func (s *Service) checkNoLiveChildren(ctx context.Context, id uuid.UUID) error {
	n, err := s.store.CountLiveChildren(ctx, &id)
	if err != nil {
		return fmt.Errorf("count live children: %w", err)
	}
	if n > 0 {
		return &LiveChildrenError{Count: n}
	}
	return nil
}
