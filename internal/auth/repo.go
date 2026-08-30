package auth

import (
	"context"

	"github.com/google/uuid"

	"github.com/chiempham/warp-work/internal/store"
)

// Repository is the data this package needs, declared here rather than in
// store: the consumer states what it requires, so a test can satisfy it with a
// dozen lines instead of a database.
//
// *store.Queries implements it as generated — asserted below, so a query
// signature changing under a regeneration is a compile error here rather than a
// surprise at the call site.
type Repository interface {
	GetPasswordCredential(ctx context.Context, email string) (store.GetPasswordCredentialRow, error)
	RecordFailedLogin(ctx context.Context, arg store.RecordFailedLoginParams) (store.RecordFailedLoginRow, error)
	ClearFailedLogins(ctx context.Context, authProviderID uuid.UUID) error
	MarkProviderUsed(ctx context.Context, arg store.MarkProviderUsedParams) error
	CreateAuthSession(ctx context.Context, arg store.CreateAuthSessionParams) (store.AuthSession, error)
	LiveSessionByTokenHash(ctx context.Context, arg store.LiveSessionByTokenHashParams) (store.LiveSessionByTokenHashRow, error)
	TouchAuthSession(ctx context.Context, arg store.TouchAuthSessionParams) error
	GetUserProfile(ctx context.Context, userID uuid.UUID) (store.UserProfile, error)
}

var _ Repository = (*store.Queries)(nil)
