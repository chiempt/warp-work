# Warp

> The frame that holds everything together.

A personal work system that sees everything arriving across several parallel lives, tracks what
is owed to whom, and drafts the work — leaving every outbound action to the owner's review.

**Status:** foundation. No application code yet.

**Stack:** Go + Echo (api, worker) · Postgres 17 + pgvector · Redis · Next.js + React + shadcn/ui +
Magic UI · Docker Compose on a single VPS.

## Start here

| Document | What it holds |
|---|---|
| [docs/warp-project-context.md](docs/warp-project-context.md) | What Warp is — scope, data model, architecture, build phases. The source of truth. |
| [CLAUDE.md](CLAUDE.md) | Rules for building it. Hard invariants, phase discipline, model usage. |
| [docs/conventions.md](docs/conventions.md) | Mechanical conventions — naming, layout, git, migrations, logging, tests. |
| [docs/glossary.md](docs/glossary.md) | Domain vocabulary. Read before naming anything. |
| [docs/decisions/](docs/decisions/) | Architecture decision records, including what is still open. |
| [docs/open-questions.md](docs/open-questions.md) | Unresolved design questions blocking specific phases. |

## Running locally

Requires Go 1.25+, a local Postgres 17 with `pgvector`, a local Redis, and pnpm. Nothing else is
installed globally — goose, sqlc, and ogen are pinned in `go.mod` as tool dependencies and
run through `go tool`.

```bash
make setup        # env file, warp role + database, migrations — run once
make run-api      # http://localhost:8080

# Create the owner. This is the only thing that does, and it succeeds once:
# a second attempt is a 409, not a second account.
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-enough-password","displayName":"Your Name"}'

make seed         # fixture contexts, attached to whoever registered
make run-worker   # in another shell
make run-web      # http://localhost:3000
```

`make seed` deliberately refuses to run before registration. Seeding an owner
would create an account with no sign-in method — `register` would refuse it as
an existing owner and `login` would find no credential, locking everyone out.

`make setup` provisions a non-superuser `warp` role owning a `warp` database, installs `pgvector`
(which needs a superuser once), generates the credential encryption key, and writes
`infra/.env`. Override the superuser it connects as with `PGSUPERUSER`.

Warp uses Redis database index 4 so its keys stay clear of anything else on a shared local Redis.

The API contract is browsable at <http://localhost:8080/docs> once the api is running, and the
document itself at `/openapi.yaml`.

`make help` lists every target. `make check` is what CI runs — including `openapi-check`, which
fails if the generated server is stale relative to the spec.

If a machine has no local Postgres or Redis, `make docker-up` starts them in containers instead —
on ports 5433 and 6380, so they cannot collide with a local install.

## Build phases

1. **See** — contexts, accounts, signals, Gmail + Calendar ingestion, timeline. No AI.
2. **Understand** — extraction into tasks, events, commitments. Reminders.
3. **Draft** — work sessions, runs, proposed actions. Autonomy locked at `draft`.
4. **Act** — the autonomy ladder. Zalo OA.

Phase 1 is not started.

## Non-goals

Multi-user, teams, permissions, billing, a mobile app, unofficial platform integrations, and
anything approaching a general-purpose assistant. See context doc §10.
