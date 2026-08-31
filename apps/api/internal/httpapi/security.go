package httpapi

import (
	"context"
	"errors"
	"log/slog"

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

// principalKey carries who the request belongs to. Handlers never take a user
// id from a parameter — which account is asking comes from the session, not
// from the caller.
//
// The session id travels with it because "sign out" and "which of these is me"
// both need to know which session is asking.
type principalKey struct{}

func (s *securityHandler) HandleSessionCookie(ctx context.Context, _ api.OperationName, t api.SessionCookie) (context.Context, error) {
	principal, err := s.auth.AuthenticatePrincipal(ctx, t.APIKey)
	if err != nil {
		if errors.Is(err, auth.ErrNoSession) {
			return ctx, ErrNoSession
		}
		// A database failure is not the caller's fault. Surfacing it as 401
		// would send someone hunting for a credential problem that is ours.
		s.logger.ErrorContext(ctx, "could not resolve session", slog.String("error", err.Error()))
		return ctx, err
	}

	// The raw token is kept alongside so sign-out can revoke exactly the
	// session the request arrived on, without a second lookup.
	ctx = context.WithValue(ctx, principalKey{}, principal)
	return context.WithValue(ctx, sessionTokenKey{}, t.APIKey), nil
}

type sessionTokenKey struct{}

// principalFrom reports which account and session the current request belongs
// to. Absent only on the endpoints that opt out of the security requirement.
func principalFrom(ctx context.Context) (auth.Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(auth.Principal)
	return p, ok
}

func sessionTokenFrom(ctx context.Context) string {
	token, _ := ctx.Value(sessionTokenKey{}).(string)
	return token
}
