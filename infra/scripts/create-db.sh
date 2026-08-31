#!/usr/bin/env bash
# Provision Warp's role, database, and the vector extension on a local Postgres,
# then write the resulting DATABASE_URL into infra/.env.
#
# Safe to re-run: if the DATABASE_URL already in infra/.env connects, nothing is
# touched. Pass ROTATE=1 to force a new password.
#
# Rotating on every run would be worse than useless — it invalidates any other
# tool pointed at the same database (psql history, a GUI client, a running
# service) for no reason.
set -euo pipefail

ENV_FILE="infra/.env"
PGSUPERUSER="${PGSUPERUSER:-$USER}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
DB_NAME="${WARP_DB_NAME:-warp}"
DB_ROLE="${WARP_DB_ROLE:-warp}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "error: $ENV_FILE does not exist; run 'make env' first" >&2
    exit 1
fi

psql_super() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGSUPERUSER" -v ON_ERROR_STOP=1 -q "$@"; }

if ! psql_super -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
    echo "error: cannot reach Postgres at $PGHOST:$PGPORT as '$PGSUPERUSER'." >&2
    echo "       Start it, or set PGHOST/PGPORT/PGSUPERUSER." >&2
    exit 1
fi

# If what is already configured works, leave it alone.
existing_url="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
if [[ "${ROTATE:-0}" != "1" && -n "$existing_url" ]]; then
    if psql "$existing_url" -tAc 'SELECT 1' >/dev/null 2>&1; then
        echo "database already reachable with the configured DATABASE_URL; nothing to do"
        echo "  (re-run with ROTATE=1 to issue a new password)"
        exit 0
    fi
fi

password="$(openssl rand -hex 24)"

# The role owns the database. It is deliberately not a superuser.
psql_super -d postgres <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_ROLE}') THEN
        CREATE ROLE ${DB_ROLE} LOGIN PASSWORD '${password}';
    ELSE
        ALTER ROLE ${DB_ROLE} LOGIN PASSWORD '${password}';
    END IF;
END
\$\$;
SQL

if ! psql_super -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    psql_super -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_ROLE}"
    echo "created database ${DB_NAME}"
fi

# pgvector is not a trusted extension, so it needs a superuser once. Installing
# it here means the application role never needs elevated rights, and the
# CREATE EXTENSION in migration 00001 becomes a no-op.
psql_super -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS vector;'

url="postgres://${DB_ROLE}:${password}@${PGHOST}:${PGPORT}/${DB_NAME}?sslmode=disable"

tmp="$(mktemp)"
sed "s|^DATABASE_URL=.*|DATABASE_URL=${url}|" "$ENV_FILE" > "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "role '${DB_ROLE}' provisioned; DATABASE_URL written to $ENV_FILE"
echo "next: make migrate-up"
