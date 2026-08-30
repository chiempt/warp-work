package postgres

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/chiempham/warp-work/db"
)

// undefinedTable is what Postgres reports when goose has never run.
const undefinedTable = "42P01"

// SchemaState compares the migrations compiled into this binary against the
// migrations applied to the database.
type SchemaState struct {
	Embedded int64
	Applied  int64
}

// UpToDate reports whether the database has at least the schema this binary was
// built against.
func (s SchemaState) UpToDate() bool { return s.Applied >= s.Embedded }

// CheckSchema reads the applied migration version and compares it with the
// embedded one.
//
// The services never migrate on startup — a process that silently reshapes the
// database on deploy is how a bad release becomes unrecoverable. They refuse to
// serve instead, and an operator runs `make migrate-up`.
func CheckSchema(ctx context.Context, pool *Pool) (SchemaState, error) {
	embedded, err := latestEmbeddedVersion()
	if err != nil {
		return SchemaState{}, err
	}

	var applied int64
	row := pool.QueryRow(ctx, `SELECT COALESCE(MAX(version_id), 0) FROM goose_db_version WHERE is_applied`)
	if err := row.Scan(&applied); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == undefinedTable {
			// goose has never run against this database.
			return SchemaState{Embedded: embedded, Applied: 0}, nil
		}
		return SchemaState{}, fmt.Errorf("read applied migration version: %w", err)
	}
	return SchemaState{Embedded: embedded, Applied: applied}, nil
}

// latestEmbeddedVersion is the highest version number in db/migrations.
func latestEmbeddedVersion() (int64, error) {
	entries, err := fs.ReadDir(db.Migrations, "migrations")
	if err != nil {
		return 0, fmt.Errorf("read embedded migrations: %w", err)
	}

	var latest int64
	for _, e := range entries {
		if e.IsDir() || path.Ext(e.Name()) != ".sql" {
			continue
		}
		version, err := parseVersion(e.Name())
		if err != nil {
			return 0, err
		}
		if version > latest {
			latest = version
		}
	}
	if latest == 0 {
		return 0, errors.New("no migrations are embedded in this binary")
	}
	return latest, nil
}

// parseVersion reads the leading number from a goose filename such as
// 00001_foundation.sql.
func parseVersion(name string) (int64, error) {
	prefix, _, found := strings.Cut(name, "_")
	if !found {
		return 0, fmt.Errorf("migration %q is not named NNNNN_description.sql", name)
	}
	version, err := strconv.ParseInt(prefix, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("migration %q has a non-numeric version: %w", name, err)
	}
	return version, nil
}
