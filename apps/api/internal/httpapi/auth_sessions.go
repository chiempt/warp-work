package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
)

// GetCurrentSession answers who is signed in, and on what.
func (h *Handler) GetCurrentSession(ctx context.Context) (api.GetCurrentSessionRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	profile, err := h.auth.Profile(ctx, principal.UserID)
	if err != nil {
		return nil, err
	}

	sessions, err := h.auth.ListSessions(ctx, principal.UserID)
	if err != nil {
		return nil, err
	}

	// The session making the request is the one to describe. Reading it from
	// the list rather than a second query keeps last_seen_at consistent with
	// what the caller would see from /auth/sessions.
	var current api.Session
	for _, s := range sessions {
		if s.ID == principal.SessionID {
			current = toAPISession(s, principal.SessionID)
			break
		}
	}

	return &api.CurrentSession{
		User:    toAPIUser(profile.UserID, string(profile.Email), profile.DisplayName, profile.Timezone),
		Session: current,
	}, nil
}

// SignOut revokes the session this request arrived on, and expires the cookie.
//
// Other browsers stay signed in. Ending one of those is /auth/sessions/{id},
// which is a different intent and should look different.
func (h *Handler) SignOut(ctx context.Context) (api.SignOutRes, error) {
	if _, ok := principalFrom(ctx); !ok {
		return nil, ErrNoSession
	}

	if err := h.auth.SignOut(ctx, sessionTokenFrom(ctx)); err != nil {
		return nil, err
	}

	return &api.SignOutNoContent{
		SetCookie: api.NewOptString(h.expiredSessionCookie().String()),
	}, nil
}

// ListSessions returns every browser currently signed in.
func (h *Handler) ListSessions(ctx context.Context) (api.ListSessionsRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	sessions, err := h.auth.ListSessions(ctx, principal.UserID)
	if err != nil {
		return nil, err
	}

	items := make([]api.Session, 0, len(sessions))
	for _, s := range sessions {
		items = append(items, toAPISession(s, principal.SessionID))
	}
	return &api.SessionList{Items: items}, nil
}

// RevokeSession ends one session. Revoking one that is already gone answers
// 204: the caller asked for it not to exist, and it does not.
func (h *Handler) RevokeSession(ctx context.Context, params api.RevokeSessionParams) (api.RevokeSessionRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	err := h.auth.RevokeSession(ctx, principal.UserID, params.SessionId)
	switch {
	case errors.Is(err, auth.ErrNotFound):
		return &api.RevokeSessionNotFound{Error: api.Error{
			Code:    "not_found",
			Message: "no such session",
		}}, nil
	case err != nil:
		return nil, err
	}
	return &api.RevokeSessionNoContent{}, nil
}

// ListAuthProviders returns the ways this account can sign in.
func (h *Handler) ListAuthProviders(ctx context.Context) (api.ListAuthProvidersRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	providers, err := h.auth.ListProviders(ctx, principal.UserID)
	if err != nil {
		return nil, err
	}

	items := make([]api.LinkedProvider, 0, len(providers))
	for _, p := range providers {
		item := api.LinkedProvider{
			ID:        p.ID,
			Kind:      api.AuthProviderKind(p.Kind),
			IsPrimary: p.IsPrimary,
			LinkedAt:  p.LinkedAt.UTC(),
		}
		if p.Email != "" {
			item.Email = api.NewOptString(p.Email)
		}
		if p.LastLoginAt != nil {
			item.LastLoginAt = api.NewOptNilDateTime(p.LastLoginAt.UTC())
		}
		items = append(items, item)
	}
	return &api.LinkedProviderList{Items: items}, nil
}

// UnlinkAuthProvider removes one way in, unless it is the last.
//
// The 409 comes from the database trigger rather than a count taken first: a
// check followed by a delete has a window between them where a concurrent
// unlink could take the other one.
func (h *Handler) UnlinkAuthProvider(ctx context.Context, params api.UnlinkAuthProviderParams) (api.UnlinkAuthProviderRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	err := h.auth.UnlinkProvider(ctx, principal.UserID, params.ProviderId)
	switch {
	case errors.Is(err, auth.ErrLastProvider):
		return &api.UnlinkAuthProviderConflict{Error: api.Error{
			Code: "last_sign_in_method",
			Message: "this is the only way to sign in that is left; " +
				"link another one before removing it",
		}}, nil

	case errors.Is(err, auth.ErrNotFound):
		return &api.UnlinkAuthProviderNotFound{Error: api.Error{
			Code:    "not_found",
			Message: "no such sign-in method",
		}}, nil

	case err != nil:
		return nil, err
	}

	return &api.UnlinkAuthProviderNoContent{}, nil
}

// --- mapping ---------------------------------------------------------------

func toAPIUser(id [16]byte, email, displayName, timezone string) api.SignedInUser {
	return api.SignedInUser{
		ID:          id,
		Email:       email,
		DisplayName: displayName,
		Timezone:    timezone,
	}
}

func toAPISession(s auth.SessionSummary, currentID [16]byte) api.Session {
	out := api.Session{
		ID:         s.ID,
		IssuedAt:   s.IssuedAt.UTC(),
		LastSeenAt: s.LastSeenAt.UTC(),
		ExpiresAt:  s.ExpiresAt.UTC(),
		IsCurrent:  s.ID == currentID,
	}
	if s.ProviderKind != "" {
		out.ProviderKind = api.NewOptAuthProviderKind(api.AuthProviderKind(s.ProviderKind))
	}
	if s.UserAgent != "" {
		out.UserAgent = api.NewOptString(s.UserAgent)
	}
	if s.IP != nil {
		out.IP = api.NewOptNilString(s.IP.String())
	}
	return out
}

// expiredSessionCookie is the same cookie with a past expiry, which is how a
// browser is told to drop it. The attributes must match the ones it was set
// with or some browsers keep the original.
func (h *Handler) expiredSessionCookie() *http.Cookie {
	c := h.sessionCookie("", time.Unix(0, 0))
	c.MaxAge = -1
	return c
}
