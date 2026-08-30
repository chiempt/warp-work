package auth_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/chiempham/warp-work/internal/auth"
)

const password = "correct horse battery staple"

func TestHashPassword_producesTheEncodedFormTheDatabaseAccepts(t *testing.T) {
	hash, err := auth.HashPassword(password, auth.DefaultPasswordParams())
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	// The CHECK on auth_passwords.hash requires this prefix, so a plaintext
	// password cannot reach the column even by mistake.
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("hash does not carry the argon2id prefix: %q", hash)
	}
	if strings.Contains(hash, password) {
		t.Fatal("the plaintext appears in the hash")
	}
}

func TestHashPassword_saltsEveryHash(t *testing.T) {
	p := auth.DefaultPasswordParams()

	first, err := auth.HashPassword(password, p)
	if err != nil {
		t.Fatal(err)
	}
	second, err := auth.HashPassword(password, p)
	if err != nil {
		t.Fatal(err)
	}

	if first == second {
		t.Fatal("the same password hashed identically twice; the salt is not random")
	}
}

func TestVerifyPassword(t *testing.T) {
	hash, err := auth.HashPassword(password, auth.DefaultPasswordParams())
	if err != nil {
		t.Fatal(err)
	}

	if err := auth.VerifyPassword(password, hash); err != nil {
		t.Errorf("the correct password did not verify: %v", err)
	}

	err = auth.VerifyPassword("Correct horse battery staple", hash)
	if !errors.Is(err, auth.ErrPasswordMismatch) {
		t.Errorf("a password differing by one character must not verify, got %v", err)
	}

	if err := auth.VerifyPassword("", hash); !errors.Is(err, auth.ErrPasswordMismatch) {
		t.Errorf("an empty password must not verify, got %v", err)
	}
}

func TestVerifyPassword_rejectsAMalformedHash(t *testing.T) {
	for _, hash := range []string{
		"",
		"plaintext",
		"$argon2i$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA", // wrong variant
		"$argon2id$v=19$m=19456,t=2,p=1$c2FsdA",       // truncated
	} {
		if err := auth.VerifyPassword(password, hash); err == nil {
			t.Errorf("%q was accepted as a hash", hash)
		} else if errors.Is(err, auth.ErrPasswordMismatch) {
			// A malformed hash is a storage fault, not a wrong password.
			// Reporting it as a mismatch would hide corruption behind a
			// plausible-looking failed login.
			t.Errorf("%q reported as a mismatch rather than a fault", hash)
		}
	}
}

// Parameters live in the hash, so raising them does not invalidate what is
// already stored — old passwords keep verifying and can be upgraded on the next
// successful sign-in.
func TestNeedsRehash(t *testing.T) {
	weak := auth.PasswordParams{Memory: 1024, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32}
	current := auth.DefaultPasswordParams()

	weakHash, err := auth.HashPassword(password, weak)
	if err != nil {
		t.Fatal(err)
	}
	currentHash, err := auth.HashPassword(password, current)
	if err != nil {
		t.Fatal(err)
	}

	if err := auth.VerifyPassword(password, weakHash); err != nil {
		t.Fatalf("a hash made with old parameters must still verify: %v", err)
	}
	if !auth.NeedsRehash(weakHash, current) {
		t.Error("a hash below the current parameters should be flagged for rehash")
	}
	if auth.NeedsRehash(currentHash, current) {
		t.Error("a hash at the current parameters should not be flagged")
	}
}

func TestNormaliseEmail(t *testing.T) {
	for _, in := range []string{"Owner@Example.COM", "  owner@example.com  ", "OWNER@EXAMPLE.COM"} {
		if got := auth.NormaliseEmail(in); got != "owner@example.com" {
			t.Errorf("NormaliseEmail(%q) = %q", in, got)
		}
	}
}
