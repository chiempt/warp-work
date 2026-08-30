package auth

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/chiempham/warp-work/internal/store"
)

// Errors a caller is expected to handle. Anything else coming out of this
// package is a fault, not an outcome.
var (
	// ErrBadCredentials covers both a wrong password and an address that was
	// never registered. One error for both is deliberate — see
	// SignInWithPassword.
	ErrBadCredentials = errors.New("email or password is incorrect")

	// ErrLocked means too many failed attempts. LockedUntil on the returned
	// LockoutError says for how long.
	ErrLocked = errors.New("credential is locked")

	// ErrNoSession means the presented token is unknown, expired, or revoked.
	ErrNoSession = errors.New("no live session")
)

// LockoutError carries when the lock lifts, so the API can answer with a
// Retry-After the client can act on rather than a bare refusal.
type LockoutError struct {
	Until time.Time
}

func (e *LockoutError) Error() string {
	return fmt.Sprintf("credential is locked until %s", e.Until.Format(time.RFC3339))
}
func (e *LockoutError) Is(target error) bool { return target == ErrLocked }

// RetryAfter is the whole seconds a client should wait, never negative.
func (e *LockoutError) RetryAfter(now time.Time) int {
	d := e.Until.Sub(now)
	if d <= 0 {
		return 0
	}
	return int(d.Round(time.Second) / time.Second)
}

// Service is the whole of authentication. It holds no state beyond its
// dependencies, so it is safe to share across requests.
type Service struct {
	repo   Repository
	clock  func() time.Time
	policy Policy
	params PasswordParams
}

// NewService wires the service. clock may be nil, in which case time.Now is
// used — tests pass their own so session expiry can be exercised without
// waiting.
func NewService(repo Repository, clock func() time.Time) *Service {
	if clock == nil {
		clock = time.Now
	}
	return &Service{
		repo:   repo,
		clock:  clock,
		policy: DefaultPolicy(),
		params: DefaultPasswordParams(),
	}
}

// Session is what a successful sign-in produces: the record, plus the one and
// only copy of the token that will ever exist outside the caller's cookie.
type Session struct {
	Token     string
	ID        uuid.UUID
	UserID    uuid.UUID
	IssuedAt  time.Time
	ExpiresAt time.Time
}

// SignInContext is what the transport knows and this package does not.
type SignInContext struct {
	UserAgent string
	IP        *netip.Addr
}

// SignInWithPassword verifies an email and password and opens a session.
//
// Three things here are deliberate:
//
//   - An unknown address and a wrong password return the same error, so the
//     endpoint cannot be used to discover which addresses exist.
//   - An unknown address still runs a password verification against a dummy
//     hash. Skipping it would make "no such account" measurably faster, which
//     is the same disclosure by another route.
//   - The lockout is checked before the password, so repeated guessing against
//     a locked credential costs nothing to serve.
func (s *Service) SignInWithPassword(ctx context.Context, email, password string, sc SignInContext) (Session, error) {
	now := s.clock()
	email = NormaliseEmail(email)

	cred, err := s.repo.GetPasswordCredential(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Spend the same work as a real verification would.
			_ = VerifyPassword(password, dummyHash)
			return Session{}, ErrBadCredentials
		}
		return Session{}, fmt.Errorf("read password credential: %w", err)
	}

	if cred.LockedUntil.Valid && cred.LockedUntil.Time.After(now) {
		return Session{}, &LockoutError{Until: cred.LockedUntil.Time}
	}

	if err := VerifyPassword(password, cred.Hash); err != nil {
		if !errors.Is(err, ErrPasswordMismatch) {
			return Session{}, fmt.Errorf("verify password: %w", err)
		}
		return Session{}, s.recordFailure(ctx, cred.ProviderID, now)
	}

	if err := s.repo.ClearFailedLogins(ctx, cred.ProviderID); err != nil {
		return Session{}, fmt.Errorf("clear failed logins: %w", err)
	}
	if err := s.repo.MarkProviderUsed(ctx, store.MarkProviderUsedParams{
		ID:          cred.ProviderID,
		LastLoginAt: timestamp(now),
	}); err != nil {
		return Session{}, fmt.Errorf("mark provider used: %w", err)
	}

	return s.openSession(ctx, cred.UserID, &cred.ProviderID, now, sc)
}

// recordFailure counts the attempt and reports either bad credentials or, if
// this attempt exhausted the allowance, the lockout it just caused.
func (s *Service) recordFailure(ctx context.Context, providerID uuid.UUID, now time.Time) error {
	row, err := s.repo.RecordFailedLogin(ctx, store.RecordFailedLoginParams{
		ProviderID:  providerID,
		MaxAttempts: s.policy.MaxFailedAttempts,
		LockUntil:   timestamp(s.policy.LockedUntil(now)),
	})
	if err != nil {
		return fmt.Errorf("record failed login: %w", err)
	}
	if row.LockedUntil.Valid && row.LockedUntil.Time.After(now) {
		return &LockoutError{Until: row.LockedUntil.Time}
	}
	return ErrBadCredentials
}

// openSession issues the token and stores its hash.
func (s *Service) openSession(ctx context.Context, userID uuid.UUID, providerID *uuid.UUID, now time.Time, sc SignInContext) (Session, error) {
	token, hash, err := NewToken()
	if err != nil {
		return Session{}, err
	}

	id, err := uuid.NewV7()
	if err != nil {
		return Session{}, fmt.Errorf("new session id: %w", err)
	}

	expires := s.policy.ExpiresAt(now)
	row, err := s.repo.CreateAuthSession(ctx, store.CreateAuthSessionParams{
		ID:             id,
		UserID:         userID,
		AuthProviderID: providerID,
		TokenHash:      hash,
		ExpiresAt:      timestamp(expires),
		UserAgent:      truncate(sc.UserAgent, 512),
		Ip:             sc.IP,
	})
	if err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}

	return Session{
		Token:     token,
		ID:        row.ID,
		UserID:    row.UserID,
		IssuedAt:  row.IssuedAt.Time,
		ExpiresAt: row.ExpiresAt.Time,
	}, nil
}

// Authenticate resolves a presented token. Expiry and revocation are part of
// the query's predicate, so there is no way to forget to check them.
func (s *Service) Authenticate(ctx context.Context, token string) (store.LiveSessionByTokenHashRow, error) {
	now := s.clock()

	row, err := s.repo.LiveSessionByTokenHash(ctx, store.LiveSessionByTokenHashParams{
		TokenHash: HashToken(token),
		Now:       timestamp(now),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.LiveSessionByTokenHashRow{}, ErrNoSession
		}
		return store.LiveSessionByTokenHashRow{}, fmt.Errorf("read session: %w", err)
	}

	// Best effort: a failed touch must not fail the request it was observing.
	_ = s.repo.TouchAuthSession(ctx, store.TouchAuthSessionParams{ID: row.ID, LastSeenAt: timestamp(now)})

	return row, nil
}

// Profile returns the signed-in owner's profile.
func (s *Service) Profile(ctx context.Context, userID uuid.UUID) (store.UserProfile, error) {
	return s.repo.GetUserProfile(ctx, userID)
}

// Policy exposes the session configuration to the transport, which needs the
// TTL to set a cookie lifetime.
func (s *Service) Policy() Policy { return s.policy }

// NormaliseEmail is applied on both write and read, so a credential stored with
// one casing is found with another. The column is citext, which handles case;
// this also strips surrounding whitespace, which citext does not.
func NormaliseEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// dummyHash is verified against when no credential exists, so that path costs
// the same as a real one. Its plaintext is unreachable by construction.
var dummyHash = "$argon2id$v=19$m=19456,t=2,p=1$" +
	"AAAAAAAAAAAAAAAAAAAAAA$" +
	"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

func timestamp(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t.UTC(), Valid: true}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
func resgister() {
	
}
