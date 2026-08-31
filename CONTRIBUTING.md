# Contributing to Warp

Warp is a personal work system: it sees everything arriving across several parallel lives, tracks
what is owed to whom, and drafts the work — leaving every outbound action to a human's review.

Read [`docs/warp-project-context.md`](docs/warp-project-context.md) before anything else. It is what
Warp *is*. [`CLAUDE.md`](CLAUDE.md) is how it gets built, and it applies to people as much as to
agents.

## Getting a copy running

Requires Go 1.25+, a local Postgres 17 with `pgvector`, a local Redis, and pnpm. Nothing else is
installed globally — goose, sqlc and ogen are pinned in `go.mod` as tool dependencies.

```sh
make setup                    # env file, role and database, migrations. Safe to re-run.
make dev                      # api on :8080, web on :3000. Ctrl-C stops both.

# In another shell — this is the only thing that creates an account:
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-enough-password","displayName":"Your Name"}'

make seed                     # fixture contexts, attached to whoever registered
```

The contract is browsable at <http://localhost:8080/docs>.

`make help` lists every target. **`make check` is the gate** — vet, tests, and a check that generated
code still matches its source. Run it before opening a pull request.

## Things that will get a change rejected

These are not style preferences. Breaking one is a schema redesign, not a bug fix, and
[`CLAUDE.md`](CLAUDE.md) states them in full.

1. **`signals` are immutable.** Tasks, events and commitments are derived. Extraction must be
   re-runnable over historical signals without loss, so it stays a pure function of
   `(signal, prompt version)`. A database trigger enforces the immutability.
2. **Context is the axis.** Every signal, task, person, memory note and autonomy rule carries a
   `context_id`. A query reaching across contexts without an explicit reason is a bug.
3. **Nothing leaves the system without a trace.** No code path sends an email, posts a message or
   writes to an external record except `proposed_actions` → `executions`. Do not add a convenience
   helper that skips it.
4. **The owner can always get back in.** `auth_providers` may never drop to zero rows. A trigger
   enforces it; do not add a path around it.
5. **Autonomy is per `(context, action_type)`.** Never a global flag or an environment variable.
6. **Never write code against an unofficial API.** Zalo personal, Facebook personal messages and
   Instagram personal are permanently out of scope — account-ban risk, not a preference. Workarounds,
   scrapers and browser automation for them will not be accepted.
7. **Respect the phase order.** The schema is complete; the code paths are not. A table existing is
   not permission to build the behaviour that uses it. In particular the `auto` autonomy level must
   not be reachable in code before Phase 4.

## How changes are made here

### Adding or changing an API endpoint — the spec comes first

```sh
# 1. Declare it in docs/api/openapi.yaml with an operationId.
# 2. Regenerate both sides:
make openapi                  # Go server  -> apps/api/internal/api
pnpm --dir apps/web api:types # TS client  -> apps/web/src/lib/api/schema.d.ts
# 3. It answers 501 immediately. Implement the method on Handler.
```

Routes are declared in the spec, never in Go. **Validation belongs in the schema** — required
parameters, formats, ranges, enums. A handler that re-checks what the schema already declares has
forked the contract.

### Changing the schema

One migration per module, named after it, numbered in dependency order. Never edit a migration that
has been applied — write a new one.

```sh
make migrate-new name=add_commitment_tags
make migrate-up
make sqlc                     # regenerate internal/store in the same commit
```

Every migration needs a `-- +goose Down` that works. Verify it: roll all the way down, back up, and
diff the schema. Drops go by object kind — every table before any function, because a trigger depends
on its function.

Adding a value to an enum needs its own migration marked `-- +goose NO TRANSACTION`. A value can
never be removed.

### Generated code

Nothing under these is hand-written:

| Path | Generated from | Command |
|---|---|---|
| `internal/store/` | `db/migrations` + `db/queries` | `make sqlc` |
| `apps/api/internal/api/` | `docs/api/openapi.yaml` | `make openapi` |
| `apps/web/src/lib/api/schema.d.ts` | `docs/api/openapi.yaml` | `pnpm api:types` |

Commit it alongside the source it came from. `make check` fails if it is stale. The editor marks
these directories read-only ([`.vscode/settings.json`](.vscode/settings.json)) so the rule is
enforced rather than remembered.

### Where code goes

```
apps/*/cmd/               wiring and shutdown only
apps/api/internal/httpapi transport: parse, render, middleware. ~20 lines per handler.
internal/<feature>/       the feature's logic, its types, and the interface to the data it needs
internal/domain/          concepts several features share. No I/O, imports nothing.
internal/store/           generated
internal/platform/        pool, logger, queue
```

Dependencies point downwards. `internal/<feature>` never imports `httpapi`, `api` or `apps/*` — if it
seems to need to, the dependency is the wrong way round. Anything under `apps/api/internal/` is
importable *only* by `apps/api`, which the compiler enforces; shared logic belongs at the root so the
worker can use it too.

An interface is declared by the package that *consumes* it, listing only the methods it actually
needs — see [`internal/auth/repo.go`](internal/auth/repo.go).

## Progress

[`docs/planning/backlog.csv`](docs/planning/backlog.csv) holds every task and its real status.
Read [`docs/planning/README.md`](docs/planning/README.md) for what each column means.

**Update the row in the same commit as the work.** A status that lags is worse than no status,
because it gets trusted. `Done` needs proof in *Location / Evidence* — a passing test, an applied
migration, a command that works.

If your change is not in the backlog, add a row for it.

## Commits and pull requests

- Branches: `phase-N/short-description`, `fix/short-description`, `docs/short-description`.
- Conventional subjects: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `db:` for migrations.
  Imperative, under 72 characters. Reference a backlog ID where one applies.
- One logical change per commit. A migration, its `sqlc` regeneration and the code depending on it
  may share a commit; two unrelated migrations may not.
- A commit that changes a hard invariant, an ADR or `CLAUDE.md` says so in the body and explains why.
- Include the output of `make check`.

## Decisions

A choice that would be expensive to reverse gets a record in [`docs/decisions/`](docs/decisions/).
Never delete or rewrite one — supersede it with a new record, so the reasoning that led there
survives. The format and when to write one are in
[`docs/decisions/README.md`](docs/decisions/README.md).

Unresolved design questions live in [`docs/open-questions.md`](docs/open-questions.md). If your work
depends on one, pick a defensible default, mark it `TODO(open-question-N)`, and say which default you
chose and why.

## Licence

**Not yet chosen.** `docs/api/openapi.yaml` currently declares `Proprietary` and there is no
`LICENSE` file, so nobody can legally contribute yet. This has to be settled before the first
outside pull request — raise it in an issue rather than in code.
