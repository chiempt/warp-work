package db_test

import (
	"io/fs"
	"path"
	"regexp"
	"strconv"
	"testing"

	"github.com/chiempham/warp-work/db"
)

// Filenames are the version numbers. goose panics at runtime on a duplicate, so
// the check belongs in the test suite where it is a red build instead.
var migrationName = regexp.MustCompile(`^(\d{5})_[a-z0-9_]+\.sql$`)

func migrationFiles(t *testing.T) []string {
	t.Helper()
	entries, err := fs.ReadDir(db.Migrations, "migrations")
	if err != nil {
		t.Fatalf("read embedded migrations: %v", err)
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	if len(names) == 0 {
		t.Fatal("no migrations are embedded")
	}
	return names
}

func TestMigrations_areNamedConsistently(t *testing.T) {
	for _, name := range migrationFiles(t) {
		if path.Ext(name) != ".sql" {
			t.Errorf("%s: only .sql files belong in db/migrations", name)
			continue
		}
		if !migrationName.MatchString(name) {
			t.Errorf("%s: want NNNNN_snake_case.sql (five digits)", name)
		}
	}
}

// A duplicate version makes goose panic before it applies anything — the whole
// migration path is dead until someone renames a file.
func TestMigrations_versionsAreUnique(t *testing.T) {
	seen := map[int64]string{}
	for _, name := range migrationFiles(t) {
		m := migrationName.FindStringSubmatch(name)
		if m == nil {
			continue // reported by the naming test
		}
		version, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil {
			t.Errorf("%s: unparseable version: %v", name, err)
			continue
		}
		if prev, dup := seen[version]; dup {
			t.Errorf("version %d is claimed by both %s and %s", version, prev, name)
			continue
		}
		seen[version] = name
	}
}

// Seeds are not migrations. A plain SQL script in db/migrations either fails to
// apply or, worse, applies as an empty migration and burns a version number.
func TestMigrations_haveGooseAnnotations(t *testing.T) {
	for _, name := range migrationFiles(t) {
		body, err := fs.ReadFile(db.Migrations, path.Join("migrations", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for _, marker := range []string{"-- +goose Up", "-- +goose Down"} {
			if !regexp.MustCompile("(?m)^" + regexp.QuoteMeta(marker)).Match(body) {
				t.Errorf("%s: missing %q — is this a seed that belongs in db/seeds?", name, marker)
			}
		}
	}
}
