#!/usr/bin/env bash
# Drop and rebuild Warp's schema from scratch, then re-apply every migration.
#
# Development only. It destroys all data in the target database.
#
# The extensions are re-created by the superuser before goose runs, because
# `vector` is not a trusted extension: the application role cannot create it.
# Migration 00001 then finds it present and its CREATE EXTENSION is a no-op.
set -euo pipefail

ENV_FILE="infra/.env"
PGSUPERUSER="${PGSUPERUSER:-$USER}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
DB_NAME="${WARP_DB_NAME:-warp}"
DB_ROLE="${WARP_DB_ROLE:-warp}"

[[ -f "$ENV_FILE" ]] || { echo "error: $ENV_FILE does not exist; run 'make setup' first" >&2; exit 1; }

if [[ "${APP_ENV:-development}" != "development" ]]; then
    echo "error: db-reset refuses to run outside development (APP_ENV=$APP_ENV)" >&2
    exit 1
fi

if [[ "${FORCE:-0}" != "1" ]]; then
    read -r -p "This destroys everything in database '${DB_NAME}'. Type the database name to confirm: " answer
    [[ "$answer" == "$DB_NAME" ]] || { echo "aborted"; exit 1; }
fi

psql -h "$PGHOST" -p "$PGPORT" -U "$PGSUPERUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<SQL
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION ${DB_ROLE};
GRANT ALL ON SCHEMA public TO ${DB_ROLE};
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

echo "schema rebuilt; extensions reinstalled"
