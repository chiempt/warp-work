package httpapi

import (
	"context"
	"errors"

	"github.com/chiempham/warp-work/apps/api/internal/api"
)

// ErrNoSession is returned when a request carries no usable session cookie.
var ErrNoSession = errors.New("no valid session")

// securityHandler answers the `sessionCookie` scheme declared in the contract.
//
// It rejects everything for now. Sign-in lands in internal/auth; until it does,
// no cookie can be valid, and every secured operation answers 401. That is what
// the contract already claims — the alternative was leaving the spec silent and
// the API genuinely public.
type securityHandler struct{}

var _ api.SecurityHandler = securityHandler{}

func (securityHandler) HandleSessionCookie(ctx context.Context, _ api.OperationName, _ api.SessionCookie) (context.Context, error) {
	return ctx, ErrNoSession
}
