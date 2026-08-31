package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// googleIssuer is the OIDC issuer. Endpoints and signing keys are discovered
// from it rather than hard-coded, so a key rotation on Google's side needs no
// change here.
const googleIssuer = "https://accounts.google.com"

var (
	// ErrProviderNotConfigured means the client id or secret is missing. This
	// is a configuration gap, not a caller mistake.
	ErrProviderNotConfigured = errors.New("sign-in provider is not configured")

	// ErrStateMismatch means the callback did not carry the state this server
	// issued — a forged callback, or a stale browser tab.
	ErrStateMismatch = errors.New("sign-in state does not match")
)

// GoogleConfig is what an OAuth client needs. Filling these three in is the
// only thing required to turn Google sign-in on.
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func (c GoogleConfig) configured() bool {
	return c.ClientID != "" && c.ClientSecret != "" && c.RedirectURL != ""
}

// Identity is what a provider asserts about a person.
type Identity struct {
	// Subject is the provider's immutable identifier — Google's `sub` claim.
	// This is what an account is keyed on, never the email.
	Subject string
	// Email and EmailVerified are used only to link a federated identity to an
	// account that already exists, and only when verified.
	Email         string
	EmailVerified bool
	Name          string
}

// GoogleProvider performs the OIDC dance with Google.
//
// Discovery happens on first use rather than at construction: a server that
// cannot start because Google is unreachable would be a worse failure than a
// sign-in that cannot complete. A failed discovery is not cached, so a
// transient outage does not disable sign-in permanently.
type GoogleProvider struct {
	cfg GoogleConfig

	mu       sync.Mutex
	provider *oidc.Provider
}

func NewGoogleProvider(cfg GoogleConfig) *GoogleProvider {
	return &GoogleProvider{cfg: cfg}
}

// Configured reports whether sign-in with this provider is possible at all.
func (g *GoogleProvider) Configured() bool { return g.cfg.configured() }

func (g *GoogleProvider) discover(ctx context.Context) (*oidc.Provider, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.provider != nil {
		return g.provider, nil
	}

	p, err := oidc.NewProvider(ctx, googleIssuer)
	if err != nil {
		return nil, fmt.Errorf("discover %s: %w", googleIssuer, err)
	}
	g.provider = p
	return p, nil
}

func (g *GoogleProvider) oauthConfig(p *oidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     g.cfg.ClientID,
		ClientSecret: g.cfg.ClientSecret,
		RedirectURL:  g.cfg.RedirectURL,
		Endpoint:     p.Endpoint(),
		// Identity only. Reading mail or calendar is a separate consent that
		// belongs to `accounts`, and asking for it here would tie a background
		// sync token to the lifetime of a browser session.
		Scopes: []string{oidc.ScopeOpenID, "email", "profile"},
	}
}

// AuthCodeURL is where the browser is sent to consent.
func (g *GoogleProvider) AuthCodeURL(ctx context.Context, state, nonce string) (string, error) {
	if !g.cfg.configured() {
		return "", ErrProviderNotConfigured
	}

	p, err := g.discover(ctx)
	if err != nil {
		return "", err
	}

	return g.oauthConfig(p).AuthCodeURL(state, oidc.Nonce(nonce)), nil
}

// Verify exchanges the code and validates the resulting ID token: signature
// against Google's published keys, issuer, audience, expiry, and the nonce this
// server issued.
//
// The nonce check is what stops an ID token obtained elsewhere from being
// replayed into this callback.
func (g *GoogleProvider) Verify(ctx context.Context, code, nonce string) (Identity, error) {
	if !g.cfg.configured() {
		return Identity{}, ErrProviderNotConfigured
	}

	p, err := g.discover(ctx)
	if err != nil {
		return Identity{}, err
	}

	token, err := g.oauthConfig(p).Exchange(ctx, code)
	if err != nil {
		return Identity{}, fmt.Errorf("exchange authorization code: %w", err)
	}

	rawID, ok := token.Extra("id_token").(string)
	if !ok || rawID == "" {
		return Identity{}, errors.New("token response carried no id_token")
	}

	idToken, err := p.Verifier(&oidc.Config{ClientID: g.cfg.ClientID}).Verify(ctx, rawID)
	if err != nil {
		return Identity{}, fmt.Errorf("verify id token: %w", err)
	}
	if idToken.Nonce != nonce {
		return Identity{}, ErrStateMismatch
	}

	var claims struct {
		Subject       string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return Identity{}, fmt.Errorf("read id token claims: %w", err)
	}
	if claims.Subject == "" {
		return Identity{}, errors.New("id token carried no subject")
	}

	return Identity{
		Subject:       claims.Subject,
		Email:         NormaliseEmail(claims.Email),
		EmailVerified: claims.EmailVerified,
		Name:          claims.Name,
	}, nil
}

// randomToken is used for the OAuth state and nonce. Both only need to be
// unguessable and single-use.
func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("read random token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// FlowState is what has to survive the redirect to Google and back. The
// transport carries it in a short-lived HttpOnly cookie.
type FlowState struct {
	State    string
	Nonce    string
	ReturnTo string
}

// NewFlowState issues a fresh state and nonce for one sign-in attempt.
func NewFlowState(returnTo string) (FlowState, error) {
	state, err := randomToken()
	if err != nil {
		return FlowState{}, err
	}
	nonce, err := randomToken()
	if err != nil {
		return FlowState{}, err
	}
	if returnTo == "" {
		returnTo = "/"
	}
	return FlowState{State: state, Nonce: nonce, ReturnTo: returnTo}, nil
}
