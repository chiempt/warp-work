package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/netip"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
	"github.com/chiempham/warp-work/internal/config"
)

// sessionCookieName must match the `sessionCookie` security scheme in
// docs/api/openapi.yaml. If the two ever disagree, every request is
// unauthenticated and nothing says why.
const sessionCookieName = "warp_session"

// Login signs the owner in with an email and password.
//
// The response type chosen here is what sets the status code — 200, 401 or 429
// — so there is no path where the body and the status can disagree.
func (h *Handler) Login(ctx context.Context, req *api.LoginRequest) (api.LoginRes, error) {
	session, err := h.auth.SignInWithPassword(ctx, req.Email, req.Password, clientInfoFrom(ctx))

	switch {
	case errors.Is(err, auth.ErrBadCredentials):
		// One message for a wrong password and for an address that was never
		// registered. Distinguishing them would turn this endpoint into a way
		// to enumerate addresses.
		return &api.ErrorEnvelope{Error: api.Error{
			Code:    "unauthenticated",
			Message: "email or password is incorrect",
		}}, nil

	case errors.Is(err, auth.ErrLocked):
		var locked *auth.LockoutError
		errors.As(err, &locked)

		h.logger.WarnContext(ctx, "sign-in attempt against a locked credential",
			slog.Time("locked_until", locked.Until))

		return &api.ErrorEnvelopeHeaders{
			RetryAfter: api.NewOptInt(locked.RetryAfter(time.Now())),
			Response: api.ErrorEnvelope{Error: api.Error{
				Code:    "locked",
				Message: "too many failed attempts; try again later",
			}},
		}, nil

	case err != nil:
		// Not an outcome the contract describes. NewError logs it and answers
		// 500 without saying anything specific.
		return nil, err
	}

	current, err := h.currentSession(ctx, session)
	if err != nil {
		return nil, err
	}

	return &api.CurrentSessionHeaders{
		SetCookie: api.NewOptString(h.sessionCookie(session.Token, session.ExpiresAt).String()),
		Response:  current,
	}, nil
}

// currentSession assembles the body both sign-in operations return.
func (h *Handler) currentSession(ctx context.Context, s auth.Session) (api.CurrentSession, error) {
	profile, err := h.auth.Profile(ctx, s.UserID)
	if err != nil {
		return api.CurrentSession{}, err
	}

	return api.CurrentSession{
		User: api.SignedInUser{
			ID:          profile.UserID,
			Email:       string(profile.Email),
			DisplayName: profile.DisplayName,
			Timezone:    profile.Timezone,
		},
		Session: api.Session{
			ID:         s.ID,
			IssuedAt:   s.IssuedAt.UTC(),
			LastSeenAt: s.IssuedAt.UTC(),
			ExpiresAt:  s.ExpiresAt.UTC(),
			IsCurrent:  true,
		},
	}, nil
}

// sessionCookie is a transport decision, not a service one: auth returns a
// token and an expiry, and this is where it becomes a cookie. If a CLI is ever
// added it uses the same token without this.
func (h *Handler) sessionCookie(token string, expires time.Time) *http.Cookie {
	return &http.Cookie{
		Name:  sessionCookieName,
		Value: token,
		Path:  "/",
		// Expires and Max-Age together, because older clients honour only one.
		Expires: expires,
		MaxAge:  int(time.Until(expires).Seconds()),
		// Unreadable from JavaScript: a scripting flaw in the dashboard cannot
		// lift the session.
		HttpOnly: true,
		// Not over plain HTTP in development, or the browser drops it and
		// nothing works locally.
		Secure:   h.cfg.Env == config.EnvProduction,
		SameSite: http.SameSiteLaxMode,
	}
}

// clientInfo is what the transport knows about the caller and the auth service
// does not. ogen hands a handler only a context and the decoded request, so
// middleware puts it there.
type clientInfo struct {
	userAgent string
	ip        *netip.Addr
}

type clientInfoKey struct{}

func withClientInfo(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := c.Request()

		info := clientInfo{userAgent: req.UserAgent()}
		if addr, err := netip.ParseAddr(c.RealIP()); err == nil {
			info.ip = &addr
		}

		c.SetRequest(req.WithContext(context.WithValue(req.Context(), clientInfoKey{}, info)))
		return next(c)
	}
}

func clientInfoFrom(ctx context.Context) auth.SignInContext {
	info, _ := ctx.Value(clientInfoKey{}).(clientInfo)
	return auth.SignInContext{UserAgent: info.userAgent, IP: info.ip}
}
