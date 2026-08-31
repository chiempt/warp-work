package auth

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/chiempham/warp-work/internal/store"
)

// restrictViolation is SQLSTATE 23001 — what the trigger guarding the last
// sign-in method raises.
const restrictViolation = "23001"

var (
	// ErrNotFound means the row does not exist, or does not belong to this
	// user. Deliberately one error for both: an id from elsewhere must not be
	// distinguishable from one that never existed.
	ErrNotFound = errors.New("not found")

	// ErrLastProvider means unlinking would leave no way to sign in.
	ErrLastProvider = errors.New("cannot unlink the last sign-in method")
)

// Principal is who a request belongs to, resolved from its cookie.
//
// It carries the session as well as the user because "sign out" and "which of
// these is me" both need to know *which* session is asking.
type Principal struct {
	UserID       uuid.UUID
	SessionID    uuid.UUID
	ProviderKind string
}

// SessionSummary is a session as the owner sees it. The token is absent; only
// its hash was ever stored.
type SessionSummary struct {
	ID           uuid.UUID
	ProviderKind string
	IssuedAt     time.Time
	LastSeenAt   time.Time
	ExpiresAt    time.Time
	UserAgent    string
	IP           *netip.Addr
}

// ProviderSummary is one way in, as the owner sees it. No secret appears here,
// which is why `auth_providers` holds none.
type ProviderSummary struct {
	ID          uuid.UUID
	Kind        string
	Email       string
	IsPrimary   bool
	LinkedAt    time.Time
	LastLoginAt *time.Time
}

// ListSessions returns every browser currently signed in, newest activity
// first.
func (s *Service) ListSessions(ctx context.Context, userID uuid.UUID) ([]SessionSummary, error) {
	rows, err := s.store.ListLiveSessions(ctx, store.ListLiveSessionsParams{
		UserID: userID,
		Now:    timestamp(s.clock()),
	})
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}

	out := make([]SessionSummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, SessionSummary{
			ID:           r.ID,
			ProviderKind: providerKind(r.ProviderKind),
			IssuedAt:     r.IssuedAt.Time,
			LastSeenAt:   r.LastSeenAt.Time,
			ExpiresAt:    r.ExpiresAt.Time,
			UserAgent:    r.UserAgent,
			IP:           r.Ip,
		})
	}
	return out, nil
}

// RevokeSession ends one session belonging to this user.
//
// Revoking an already-revoked session is not an error: the caller asked for it
// to be gone, and it is gone. An id that is not theirs is ErrNotFound — the
// same answer as one that never existed, so the endpoint cannot be used to
// discover which sessions exist.
func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	n, err := s.store.RevokeSessionByID(ctx, store.RevokeSessionByIDParams{
		SessionID: sessionID,
		UserID:    userID,
		RevokedAt: timestamp(s.clock()),
	})
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SignOut revokes the session the request arrived on, and nothing else. Other
// browsers stay signed in — that is what ListSessions and RevokeSession are for.
func (s *Service) SignOut(ctx context.Context, token string) error {
	if _, err := s.store.RevokeSessionByTokenHash(ctx, store.RevokeSessionByTokenHashParams{
		TokenHash: HashToken(token),
		RevokedAt: timestamp(s.clock()),
	}); err != nil {
		return fmt.Errorf("sign out: %w", err)
	}
	return nil
}

// ListProviders returns the ways this user can sign in. More than one is the
// point: a single way in is a single point of lockout.
func (s *Service) ListProviders(ctx context.Context, userID uuid.UUID) ([]ProviderSummary, error) {
	rows, err := s.store.ListAuthProviders(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list sign-in methods: %w", err)
	}

	out := make([]ProviderSummary, 0, len(rows))
	for _, r := range rows {
		p := ProviderSummary{
			ID:        r.ID,
			Kind:      string(r.Kind),
			IsPrimary: r.IsPrimary,
			LinkedAt:  r.LinkedAt.Time,
		}
		if r.Email != nil {
			p.Email = *r.Email
		}
		if r.LastLoginAt.Valid {
			t := r.LastLoginAt.Time
			p.LastLoginAt = &t
		}
		out = append(out, p)
	}
	return out, nil
}

// UnlinkProvider removes one way in.
//
// The database refuses to remove the last one, so this does not check first:
// a check followed by a delete has a window between them, and the trigger does
// not.
func (s *Service) UnlinkProvider(ctx context.Context, userID, providerID uuid.UUID) error {
	n, err := s.store.DeleteAuthProvider(ctx, store.DeleteAuthProviderParams{
		ID:     providerID,
		UserID: userID,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == restrictViolation {
			return ErrLastProvider
		}
		return fmt.Errorf("unlink sign-in method: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SweepExpired deletes sessions that can no longer authenticate anything.
//
// Revoked sessions survive the grace period so that "when did I sign out of
// that machine" stays answerable for a while.
func (s *Service) SweepExpired(ctx context.Context, grace time.Duration) (int64, error) {
	n, err := s.store.SweepExpiredSessions(ctx, timestamp(s.clock().Add(-grace)))
	if err != nil {
		return 0, fmt.Errorf("sweep expired sessions: %w", err)
	}
	return n, nil
}

// Authenticate resolves a presented token into a principal.
func (s *Service) AuthenticatePrincipal(ctx context.Context, token string) (Principal, error) {
	row, err := s.Authenticate(ctx, token)
	if err != nil {
		return Principal{}, err
	}
	return Principal{
		UserID:       row.UserID,
		SessionID:    row.ID,
		ProviderKind: providerKind(row.ProviderKind),
	}, nil
}

func providerKind(k *store.AuthProviderKind) string {
	if k == nil {
		return ""
	}
	return string(*k)
}

// notFound reports whether a query found nothing, which is an outcome rather
// than a failure.
func notFound(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
