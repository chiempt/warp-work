package auth_test

import (
	"context"
	"testing"

	"github.com/chiempham/warp-work/internal/auth"
)

func TestGoogleProvider_reportsItselfUnconfigured(t *testing.T) {
	// Every field matters: a client id without a secret cannot complete an
	// exchange, and a missing redirect url produces a consent screen that
	// cannot come back.
	partial := []auth.GoogleConfig{
		{},
		{ClientID: "id"},
		{ClientID: "id", ClientSecret: "secret"},
		{ClientSecret: "secret", RedirectURL: "http://localhost/cb"},
	}

	for _, cfg := range partial {
		if auth.NewGoogleProvider(cfg).Configured() {
			t.Errorf("%+v reported itself configured", cfg)
		}
	}

	full := auth.GoogleConfig{ClientID: "id", ClientSecret: "secret", RedirectURL: "http://localhost/cb"}
	if !auth.NewGoogleProvider(full).Configured() {
		t.Error("a complete configuration should report itself configured")
	}
}

// An unconfigured provider must say so rather than attempting a network call —
// otherwise the failure looks like Google being down.
func TestGoogleProvider_refusesBeforeReachingTheNetwork(t *testing.T) {
	g := auth.NewGoogleProvider(auth.GoogleConfig{})

	if _, err := g.AuthCodeURL(context.Background(), "state", "nonce"); err != auth.ErrProviderNotConfigured {
		t.Errorf("AuthCodeURL: want ErrProviderNotConfigured, got %v", err)
	}
	if _, err := g.Verify(context.Background(), "code", "nonce"); err != auth.ErrProviderNotConfigured {
		t.Errorf("Verify: want ErrProviderNotConfigured, got %v", err)
	}
}

func TestNewFlowState(t *testing.T) {
	seen := make(map[string]bool)

	for range 50 {
		flow, err := auth.NewFlowState("/work-items")
		if err != nil {
			t.Fatalf("NewFlowState: %v", err)
		}
		if flow.State == "" || flow.Nonce == "" {
			t.Fatal("state and nonce must both be set")
		}
		// They protect different things - state against a forged callback,
		// nonce against a replayed id token - so they must not be the same
		// value.
		if flow.State == flow.Nonce {
			t.Fatal("state and nonce must be independent values")
		}
		if seen[flow.State] || seen[flow.Nonce] {
			t.Fatal("NewFlowState repeated a value")
		}
		seen[flow.State], seen[flow.Nonce] = true, true

		if flow.ReturnTo != "/work-items" {
			t.Errorf("ReturnTo = %q", flow.ReturnTo)
		}
	}
}

func TestNewFlowState_defaultsReturnToRoot(t *testing.T) {
	flow, err := auth.NewFlowState("")
	if err != nil {
		t.Fatal(err)
	}
	if flow.ReturnTo != "/" {
		t.Errorf("want /, got %q", flow.ReturnTo)
	}
}
