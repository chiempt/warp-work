package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
	"github.com/chiempham/warp-work/internal/config"
)

const (
	// googleCallbackPath is the route this server actually serves, taken from
	// docs/api/openapi.yaml. GOOGLE_REDIRECT_URL has to end here and be
	// registered at Google identically, or the consent screen returns
	// redirect_uri_mismatch - an error that names nothing in this codebase.
	googleCallbackPath = "/api/v1/auth/google/callback"

	// oauthCookieName holds the state, nonce and return path for one sign-in
	// attempt.
	oauthCookieName = "warp_oauth"

	// oauthCookieTTL is how long a consent screen may sit open. Long enough to
	// find the right Google account, short enough that a forgotten tab is not a
	// standing invitation.
	oauthCookieTTL = 10 * time.Minute
)

// StartGoogleSignIn redirects to Google's consent screen.
//
// Turning this on takes nothing but GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
// GOOGLE_REDIRECT_URL in infra/.env. Until they are set the endpoint says so
// rather than failing obscurely.
func (h *Handler) StartGoogleSignIn(ctx context.Context, params api.StartGoogleSignInParams) (*api.StartGoogleSignInFound, error) {
	returnTo := "/"
	if v, ok := params.ReturnTo.Get(); ok && v != "" {
		// The schema already rejected an absolute or protocol-relative URL, so
		// there is nothing left to validate here.
		returnTo = v
	}

	target, flow, err := h.auth.StartGoogleSignIn(ctx, returnTo)
	if err != nil {
		return nil, h.googleError(ctx, err)
	}

	return &api.StartGoogleSignInFound{
		Location:  target,
		SetCookie: api.NewOptString(h.oauthCookie(flow).String()),
	}, nil
}

// CompleteGoogleSignIn finishes the dance and lands the browser back in the app.
//
// A refusal at the consent screen is not an error condition — the person
// changed their mind. It returns them to the app with a marker the interface can
// read, rather than a JSON body in a browser window.
func (h *Handler) CompleteGoogleSignIn(ctx context.Context, params api.CompleteGoogleSignInParams) (api.CompleteGoogleSignInRes, error) {
	flow, flowErr := oauthFlowFrom(ctx)

	if reason, declined := params.Error.Get(); declined {
		h.logger.InfoContext(ctx, "google sign-in declined at the consent screen",
			slog.String("reason", reason))
		return &api.CompleteGoogleSignInFound{
			Location:  withQuery(flowReturnTo(flow, flowErr), "auth_error", "declined"),
			SetCookie: api.NewOptString(h.expiredOAuthCookie().String()),
		}, nil
	}

	if flowErr != nil {
		// No cookie, or an unreadable one. Either the attempt did not start
		// here or it started too long ago.
		return signInExpired(), nil
	}

	session, err := h.auth.CompleteGoogleSignIn(ctx, params.Code, params.State, flow, clientInfoFrom(ctx))
	switch {
	case errors.Is(err, auth.ErrStateMismatch):
		return signInExpired(), nil

	case errors.Is(err, auth.ErrNoEmailFromProvider):
		return &api.ErrorEnvelope{Error: api.Error{
			Code:    "no_email_from_provider",
			Message: "Google returned no email address, so there is nothing to create an account with",
		}}, nil

	case errors.Is(err, auth.ErrEmailTaken):
		// A race linked this address to another account first.
		return &api.ErrorEnvelope{Error: api.Error{
			Code:    "email_taken",
			Message: "an account with that email already exists; sign in with it and link Google from settings",
		}}, nil

	case err != nil:
		return nil, h.googleError(ctx, err)
	}

	// Two cookies: the session, and the flow cookie expired now that it is
	// spent. Set-Cookie is repeatable, so both travel on the same response.
	cookies := h.sessionCookie(session.Token, session.ExpiresAt).String() +
		", " + h.expiredOAuthCookie().String()

	return &api.CompleteGoogleSignInFound{
		Location:  flow.ReturnTo,
		SetCookie: api.NewOptString(cookies),
	}, nil
}

// signInExpired covers every way a callback can fail to match the attempt this
// server started: no cookie, an unreadable one, or a state that does not match.
// One message for all of them - the distinction is not the caller's business
// and each variant would only hint at how the check works.
func signInExpired() api.CompleteGoogleSignInRes {
	return &api.ErrorEnvelope{Error: api.Error{
		Code:    "sign_in_expired",
		Message: "this sign-in attempt is no longer valid; start again",
	}}
}

// googleError separates "this deployment has no Google credentials" from
// "talking to Google failed", because only the second is worth investigating.
func (h *Handler) googleError(ctx context.Context, err error) error {
	if errors.Is(err, auth.ErrProviderNotConfigured) {
		return NewError(http.StatusNotImplemented, "provider_not_configured",
			"Google sign-in is not configured on this server; "+
				"set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URL").
			WithCause(err)
	}

	h.logger.ErrorContext(ctx, "google sign-in failed", slog.String("error", err.Error()))
	return NewError(http.StatusBadGateway, "provider_unavailable",
		"could not complete sign-in with Google").WithCause(err)
}

// --- the flow cookie -------------------------------------------------------

// oauthFlowKey carries the decoded flow cookie. ogen gives a handler only a
// context and the decoded parameters, so middleware puts it there — the same
// arrangement as clientInfo.
type oauthFlowKey struct{}

func withOAuthFlow(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		cookie, err := c.Cookie(oauthCookieName)
		if err != nil || cookie.Value == "" {
			return next(c)
		}

		raw, err := base64.RawURLEncoding.DecodeString(cookie.Value)
		if err != nil {
			return next(c)
		}
		var payload oauthFlowCookie
		if err := json.Unmarshal(raw, &payload); err != nil {
			return next(c)
		}

		req := c.Request()
		flow := auth.FlowState{State: payload.State, Nonce: payload.Nonce, ReturnTo: payload.ReturnTo}
		c.SetRequest(req.WithContext(context.WithValue(req.Context(), oauthFlowKey{}, flow)))
		return next(c)
	}
}

// errNoOAuthFlow means the callback arrived without the cookie its attempt set.
var errNoOAuthFlow = errors.New("no sign-in attempt in progress")

func oauthFlowFrom(ctx context.Context) (auth.FlowState, error) {
	flow, ok := ctx.Value(oauthFlowKey{}).(auth.FlowState)
	if !ok || flow.State == "" {
		return auth.FlowState{}, errNoOAuthFlow
	}
	return flow, nil
}

type oauthFlowCookie struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	ReturnTo string `json:"r"`
}

func (h *Handler) oauthCookie(flow auth.FlowState) *http.Cookie {
	payload, _ := json.Marshal(oauthFlowCookie{
		State:    flow.State,
		Nonce:    flow.Nonce,
		ReturnTo: flow.ReturnTo,
	})

	return &http.Cookie{
		Name:  oauthCookieName,
		Value: base64.RawURLEncoding.EncodeToString(payload),
		Path:  "/api/v1/auth",
		// SameSite=Lax rather than Strict on purpose: the callback is a
		// top-level navigation arriving from Google, and Strict would withhold
		// the cookie exactly then, breaking every sign-in.
		SameSite: http.SameSiteLaxMode,
		HttpOnly: true,
		Secure:   h.cfg.Env == config.EnvProduction,
		MaxAge:   int(oauthCookieTTL.Seconds()),
		Expires:  time.Now().Add(oauthCookieTTL),
	}
}

func (h *Handler) expiredOAuthCookie() *http.Cookie {
	c := h.oauthCookie(auth.FlowState{})
	c.Value = ""
	c.MaxAge = -1
	c.Expires = time.Unix(0, 0)
	return c
}

// flowReturnTo falls back to the application root when the flow cookie is
// unusable, so a declined sign-in still lands somewhere sensible.
func flowReturnTo(flow auth.FlowState, err error) string {
	if err != nil || flow.ReturnTo == "" {
		return "/"
	}
	return flow.ReturnTo
}

func withQuery(path, key, value string) string {
	u, err := url.Parse(path)
	if err != nil {
		return path
	}
	q := u.Query()
	q.Set(key, value)
	u.RawQuery = q.Encode()
	return u.String()
}

// warnIfRedirectMismatched reports a GOOGLE_REDIRECT_URL that will not work.
//
// Two things can be wrong, and each fails somewhere other than here:
//
//   - The path does not reach this server's callback, which fails at Google
//     with redirect_uri_mismatch.
//   - The origin is not the one the browser uses, which fails *after* a
//     successful sign-in: the cookie is set, the redirect issued, and the user
//     lands on the API - which serves no pages - with a valid session they
//     cannot see. That one looks like a broken login and is not.
//
// Warnings rather than refusals: a deployment may sit behind a proxy that
// rewrites either, and being wrong about that should not stop the server. But
// saying nothing costs an afternoon.
func warnIfRedirectMismatched(logger *slog.Logger, redirectURL, webBaseURL string) {
	if redirectURL == "" {
		return
	}

	u, err := url.Parse(redirectURL)
	if err != nil {
		logger.Warn("GOOGLE_REDIRECT_URL is not a valid URL",
			slog.String("value", redirectURL),
			slog.String("error", err.Error()))
		return
	}

	if u.Path != googleCallbackPath {
		logger.Warn("GOOGLE_REDIRECT_URL does not reach this server's callback; "+
			"Google will answer redirect_uri_mismatch",
			slog.String("configured", u.Path),
			slog.String("expected", googleCallbackPath))
	}

	web, err := url.Parse(webBaseURL)
	if err != nil || web.Host == "" {
		return
	}

	if u.Host != web.Host {
		logger.Warn("GOOGLE_REDIRECT_URL does not come back through the web app; "+
			"sign-in will succeed and then land on the API, which serves no pages",
			slog.String("configured", u.Scheme+"://"+u.Host),
			slog.String("expected", web.Scheme+"://"+web.Host),
			slog.String("fix", "set GOOGLE_REDIRECT_URL to "+strings.TrimSuffix(webBaseURL, "/")+googleCallbackPath+
				" and register the same value in the Google console"))
	}
}
