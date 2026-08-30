package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"
)

// tokenBytes is the entropy in a session token. 32 bytes is well beyond
// guessing, and the token is opaque — nothing is encoded in it.
const tokenBytes = 32

// Policy is the session and lockout configuration. Every value here is a
// deliberate choice rather than a constant buried in a function.
type Policy struct {
	// TTL is how long a session lives without being refreshed. Long, because
	// this is a tool one person uses daily and a daily sign-in prompt buys
	// nothing when there is one account.
	TTL time.Duration
	// MaxFailedAttempts before the credential locks.
	MaxFailedAttempts int16
	// LockDuration is how long a locked credential stays locked.
	LockDuration time.Duration
}

// DefaultPolicy is the configuration described in ADR 0008.
func DefaultPolicy() Policy {
	return Policy{
		TTL:               30 * 24 * time.Hour,
		MaxFailedAttempts: 10,
		LockDuration:      15 * time.Minute,
	}
}

// NewToken returns a fresh session token and the hash to store for it.
//
// Only the hash is ever persisted. A database dump therefore contains nothing
// that can be presented as a session — which is the entire reason
// auth_sessions.token_hash exists instead of a token column.
func NewToken() (token string, hash []byte, err error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("read session token: %w", err)
	}

	token = base64.RawURLEncoding.EncodeToString(raw)
	return token, HashToken(token), nil
}

// HashToken is the one-way function from a presented token to the stored
// value. SHA-256 rather than argon2 on purpose: the input already has 256 bits
// of entropy, so there is nothing to slow down a guesser about — and this runs
// on every authenticated request.
func HashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// ExpiresAt is when a session issued at now should stop being accepted. now is
// supplied by the caller; nothing in this package reads the clock.
func (p Policy) ExpiresAt(now time.Time) time.Time {
	return now.Add(p.TTL).UTC()
}

// LockedUntil is when a credential that just exhausted its attempts should
// unlock.
func (p Policy) LockedUntil(now time.Time) time.Time {
	return now.Add(p.LockDuration).UTC()
}
