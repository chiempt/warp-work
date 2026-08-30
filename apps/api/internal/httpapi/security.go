package httpapi

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
)

// ErrNoSession is returned when a request carries no usable session cookie.
var ErrNoSession = errors.New("no valid session")

// securityHandler answers the `sessionCookie` scheme declared in the contract.
//
// ogen has already pulled the cookie out of the request by the time this runs;
// all that is left is to resolve it. Expiry and revocation are part of the
// query's predicate, so there is no way to forget to check them here.
type securityHandler struct {
	auth   *auth.Service
	logger *slog.Logger
}

var _ api.SecurityHandler = (*securityHandler)(nil)

// signedInUser is the user id the session resolved to, put on the context for
// handlers. Handlers never take a user id from a parameter — there is one
// owner, and which one it is comes from the session, not the caller.
type signedInUserKey struct{}

func (s *securityHandler) HandleSessionCookie(ctx context.Context, _ api.OperationName, t api.SessionCookie) (context.Context, error) {
	if s.auth == nil {
		return ctx, ErrNoSession
	}

	session, err := s.auth.Authenticate(ctx, t.APIKey)
	if err != nil {
		if errors.Is(err, auth.ErrNoSession) {
			return ctx, ErrNoSession
		}
		// A database failure is not the caller's fault. Surfacing it as 401
		// would send someone hunting for a credential problem that is ours.
		s.logger.ErrorContext(ctx, "could not resolve session", slog.String("error", err.Error()))
		return ctx, err
	}

	return context.WithValue(ctx, signedInUserKey{}, session.UserID), nil
}

// signedInUser reports which owner the current request belongs to.
func signedInUser(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(signedInUserKey{}).(uuid.UUID)
	return id, ok
}
