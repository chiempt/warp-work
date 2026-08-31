package db_test

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Registration is the only thing that creates the owner.
//
// A seeded owner is worse than no owner: `register` refuses it as an existing
// account, and `login` finds no credential for it, so nobody can get in at all.
// The fixtures attach to whoever registered instead.
func TestSeeds_doNotCreateTheOwner(t *testing.T) {
	forbidden := regexp.MustCompile(`(?i)INSERT\s+INTO\s+(users|user_profiles)\b`)

	files, err := filepath.Glob("seeds/*.sql")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Skip("no seed files")
	}

	for _, f := range files {
		body, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if loc := forbidden.FindString(string(body)); loc != "" {
			t.Errorf("%s: %q — the owner comes from POST /api/v1/auth/register, "+
				"not from a fixture; a seeded owner has no sign-in method", f, loc)
		}
	}
}

// The fixtures are meaningless without an owner, and silently seeding nothing
// would be worse than stopping.
func TestSeeds_refuseToRunWithoutAnOwner(t *testing.T) {
	body, err := os.ReadFile("seeds/001_bootstrap.sql")
	if err != nil {
		t.Skip("bootstrap seed not present")
	}
	if !strings.Contains(string(body), "RAISE EXCEPTION") {
		t.Error("the bootstrap seed must fail loudly when no owner exists")
	}
}
