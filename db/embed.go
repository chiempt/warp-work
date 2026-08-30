// Package db embeds the migration files so the running services can verify that
// the schema they were built against is the schema they are pointed at.
//
// The services never apply migrations. Applying them is an operator action
// (`make migrate-up`), per docs/conventions.md §3.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
