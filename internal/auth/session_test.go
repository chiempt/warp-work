package auth_test

import (
	"testing"
	"time"

	"github.com/chiempham/warp-work/internal/auth"
)

func TestNewToken_isUnpredictableAndNeverStoredRaw(t *testing.T) {
	seen := make(map[string]bool, 100)

	for range 100 {
		token, hash, err := auth.NewToken()
		if err != nil {
			t.Fatalf("NewToken: %v", err)
		}
		if seen[token] {
			t.Fatal("NewToken repeated a token")
		}
		seen[token] = true

		if len(hash) != 32 {
			t.Fatalf("want a 32-byte sha256 hash, got %d bytes", len(hash))
		}
		if string(hash) == token {
			t.Fatal("the stored value is the token itself")
		}
		// What is stored must be derivable from what is presented, and only in
		// that direction.
		if string(auth.HashToken(token)) != string(hash) {
			t.Fatal("HashToken does not reproduce the stored hash")
		}
	}
}

func TestPolicy_expiryIsDerivedFromTheSuppliedClock(t *testing.T) {
	p := auth.Policy{TTL: 30 * 24 * time.Hour, LockDuration: 15 * time.Minute}
	now := time.Date(2026, 8, 30, 9, 0, 0, 0, time.FixedZone("ICT", 7*60*60))

	expires := p.ExpiresAt(now)

	if got := expires.Sub(now); got != p.TTL {
		t.Errorf("want a session %v long, got %v", p.TTL, got)
	}
	// Everything the system stores is UTC, including what a policy computes.
	if expires.Location() != time.UTC {
		t.Errorf("expiry must be UTC, got %v", expires.Location())
	}
	if p.LockedUntil(now).Sub(now) != p.LockDuration {
		t.Error("lock duration not applied")
	}
}

func TestLockoutError_retryAfterNeverGoesNegative(t *testing.T) {
	now := time.Now()
	past := &auth.LockoutError{Until: now.Add(-time.Hour)}
	future := &auth.LockoutError{Until: now.Add(90 * time.Second)}

	if got := past.RetryAfter(now); got != 0 {
		t.Errorf("an expired lock must report 0, got %d", got)
	}
	if got := future.RetryAfter(now); got != 90 {
		t.Errorf("want 90 seconds, got %d", got)
	}
}
