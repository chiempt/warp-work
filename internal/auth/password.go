// Package auth owns everything about proving the owner is themselves: password
// credentials, provider identities, and the sessions they produce.
//
// It lives at the repository root rather than under apps/api because the worker
// needs it too — sweeping expired sessions is background work. Go enforces that
// choice: apps/api/internal/... is importable only from apps/api.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// PasswordParams are the argon2id cost parameters.
//
// They are written into every hash, so raising them later does not invalidate
// existing passwords: an old hash still verifies against the parameters it was
// created with, and can be re-hashed on the next successful sign-in.
type PasswordParams struct {
	Memory      uint32 // KiB
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultPasswordParams follows the OWASP argon2id recommendation of 19 MiB and
// two iterations. On one VPS serving one person, cost is not the constraint.
func DefaultPasswordParams() PasswordParams {
	return PasswordParams{
		Memory:      19 * 1024,
		Iterations:  2,
		Parallelism: 1,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// ErrPasswordMismatch is returned by VerifyPassword. It is deliberately the
// same error whether the password was wrong or the account does not exist —
// see Service.SignInWithPassword.
var ErrPasswordMismatch = errors.New("password does not match")

// HashPassword produces the standard encoded form:
//
//	$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
//
// The database CHECK on auth_passwords.hash requires this prefix, so a
// plaintext password cannot be stored even by mistake.
func HashPassword(password string, p PasswordParams) (string, error) {
	salt := make([]byte, p.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("read salt: %w", err)
	}

	key := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, p.KeyLength)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, p.Memory, p.Iterations, p.Parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword checks a password against an encoded hash, using the
// parameters recorded in the hash rather than the current defaults.
func VerifyPassword(password, encoded string) error {
	p, salt, want, err := decodeHash(encoded)
	if err != nil {
		return err
	}

	got := argon2.IDKey([]byte(password), salt, p.Iterations, p.Memory, p.Parallelism, uint32(len(want)))

	// Constant time: a comparison that returns early leaks how much of the
	// hash matched.
	if subtle.ConstantTimeCompare(got, want) != 1 {
		return ErrPasswordMismatch
	}
	return nil
}

// NeedsRehash reports whether a stored hash was made with weaker parameters
// than the ones now in use, so it can be upgraded on the next sign-in — the one
// moment the plaintext is available.
func NeedsRehash(encoded string, current PasswordParams) bool {
	p, _, _, err := decodeHash(encoded)
	if err != nil {
		return true
	}
	return p.Memory < current.Memory ||
		p.Iterations < current.Iterations ||
		p.Parallelism < current.Parallelism
}

func decodeHash(encoded string) (p PasswordParams, salt, key []byte, err error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return p, nil, nil, errors.New("password hash is not in argon2id encoded form")
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return p, nil, nil, fmt.Errorf("read hash version: %w", err)
	}
	if version != argon2.Version {
		return p, nil, nil, fmt.Errorf("unsupported argon2 version %d", version)
	}

	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.Memory, &p.Iterations, &p.Parallelism); err != nil {
		return p, nil, nil, fmt.Errorf("read hash parameters: %w", err)
	}

	if salt, err = base64.RawStdEncoding.Strict().DecodeString(parts[4]); err != nil {
		return p, nil, nil, fmt.Errorf("decode salt: %w", err)
	}
	if key, err = base64.RawStdEncoding.Strict().DecodeString(parts[5]); err != nil {
		return p, nil, nil, fmt.Errorf("decode hash: %w", err)
	}

	p.SaltLength = uint32(len(salt))
	p.KeyLength = uint32(len(key))
	return p, salt, key, nil
}
