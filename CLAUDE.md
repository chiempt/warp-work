# CLAUDE.md — Warp

Rules for any agent working in this repository. Keep this file short; it is loaded every session.

## Read first

`docs/warp-project-context.md` is the source of truth for **what** Warp is — scope, data model,
architecture, phases. This file is only the **rules** for building it. Do not restate the context
doc here; read it whenever a task touches design, schema, or scope.

## Current status

Design phase. No code exists. There is no legacy to preserve and no backward compatibility to
maintain — the first implementation is the implementation.

Corollary: if a decision is not in the context doc and not listed in its §11 open questions, it is
yours to make. Make it, state it in your response, and append it to the context doc.

## Hard invariants

Violating any of these is a schema redesign, not a bug fix. If a task appears to require breaking
one, stop and say so instead of working around it.

1. **`signals` are immutable.** Ingestion writes raw payloads and never updates them. Tasks, events,
   and commitments are *derived*. Any extraction change must be re-runnable over historical signals
   without data loss — so extraction is a pure function of `(signal, prompt version)`, never
   destructive.
2. **Context is the axis.** Every signal, task, person, memory note, and autonomy rule carries a
   `context_id`. A query that reaches across contexts without an explicit reason is a bug. Never
   let a tone profile, memory note, or draft leak from one context into another.
3. **Nothing leaves the system without a trace.** There is no code path that sends an email, posts a
   message, or writes to an external record except `proposed_actions` → `executions`, and every
   execution stores an `undo_token` or explains in `result` why none exists. Do not add a
   "quick send" helper. Ever.
4. **The owner can always get back in.** `auth_identities` may never drop to zero rows — there is
   no administrator to appeal to. A trigger enforces it; do not add a code path that works around it.
5. **Autonomy is per `(context, action_type)`.** Never a global flag, never a per-user flag, never an
   env var. Default is `draft`. Levels rise only through `autonomy_evidence`.

## Phase discipline

Build in the order of context doc §9. **The schema is complete; the code paths are not.** Tables for
later phases exist — `runs`, `proposed_actions`, `executions`, `autonomy_rules`, `memory_notes` — and
that is deliberate. What stays gated is behaviour: do not implement a later phase's behaviour early,
even when it is "just a small addition", and do not treat a table's existence as permission.

- The `auto` autonomy level **must not be reachable in code** before Phase 4. The enum may contain
  the value; no branch may act on it. A hard guard plus a test is expected.
- Phase 1 contains **no model calls at all**. If ingestion and the timeline are not reliable without
  AI, nothing above them is worth building.
- Agents run only inside an open `work_session`, scoped to that session's `context_ids`. No agent
  runs from a cron, a webhook, or a request handler.

## Connectors

- **Never write code against an unofficial or undocumented API.** Zalo personal, Facebook personal
  messages, and Instagram personal are permanently out of scope — account-ban risk, not a
  preference. Do not propose workarounds, scrapers, or browser automation for them.
- Every context must remain usable with `manual` sources alone. A dead connector degrades the
  system; it never breaks it.
- `accounts.reliability` must be visible wherever data derived from that account is shown. A report
  generated while a source was failing must say so.

## Data conventions

- Postgres 17 + `pgvector`. No separate vector database, no second datastore.
- All timestamps stored in UTC. Conversion to `Asia/Ho_Chi_Minh` happens in the presentation layer
  only — never in a query, never in a migration.
- Every table carries `user_id`, including tables that will only ever hold one user's rows.
- Ingestion is idempotent: unique on `(account_id, external_id)`; `content_hash` keys the extraction
  cache. Re-running a sync must be a no-op.
- Schema changes are migration files. Never edit a migration that has been applied.
- Sync deltas only. A full re-fetch of a mailbox is a defect, not a fallback.

## Stack

Locked. Each choice has an ADR; changing one means superseding that record, not editing a file.

| Layer | Choice | ADR |
|---|---|---|
| API + worker | Go, Echo v4 | [0005](docs/decisions/0005-backend-framework.md) |
| Database | Postgres 17 + pgvector, pgx v5, sqlc, goose | [0002](docs/decisions/0002-postgres-as-only-datastore.md), 0005 |
| Queue | Redis via asynq | 0005 |
| Frontend | Next.js App Router, React, TypeScript, Tailwind v4, shadcn/ui + Magic UI | [0006](docs/decisions/0006-frontend-stack.md) |
| Models | Claude, three tiers | [0003](docs/decisions/0003-model-tiering.md) |
| Deployment | Docker Compose, single VPS | context doc §8 |

### Go

- No ORM. SQL is hand-written in `db/queries/`, and sqlc generates the typed Go. If a query is hard
  to express in SQL, that is information about the schema — do not reach for a query builder.
- `context.Context` is the first parameter of every function that does I/O, and cancellation is
  honoured. A work session ending must actually stop in-flight agent runs.
- Errors are wrapped with `%w` and inspected with `errors.Is` / `errors.As`. No sentinel string
  matching, no `panic` outside `main`.
- Concurrency has an owner: whoever starts a goroutine is responsible for its shutdown and for
  surfacing its error. No fire-and-forget `go f()` in a request handler.
- `log/slog` with the JSON handler. One logger, injected — no package-level global.

### API contract

`docs/api/openapi.yaml` is the source of truth. **ogen** generates the server from it into
`apps/api/internal/api/`; nothing in that directory is hand-written. Browsable at `/docs`.

- **Add the operation to the spec first**, then `make openapi`. Routes are declared in the spec, not
  in Go. A new operation answers 501 until implemented — it can never break the build.
- **Put validation in the schema**, not in the handler: required parameters, uuid formats, ranges,
  enums. A handler that re-checks what the schema declares has forked the contract.
- Echo keeps the outside — request ids, logging, recovery, `/healthz`, `/readyz`, `/docs`.
  Everything under `/api/v1` belongs to the generated server.
- `make check` fails if the generated code is stale.

Go and TypeScript cannot share types by construction, so the spec is the only thing keeping the two
halves honest.

### Frontend

- shadcn primitives own every operational surface: timeline, review queue, commitments board,
  tables, forms. Reach for `Table`, `Sheet`, `Command`, `AlertDialog` before writing a styled `div`.
- **Magic UI is for motion that communicates state** — session clock-in and clock-out, the
  end-of-session report, empty states. An animation that does not tell the owner something does not
  ship. No gradient backgrounds, beams, or glassmorphism on surfaces read daily.
- Destructive and outbound actions use `AlertDialog`, never `Dialog`. Approving a proposed action
  sends real mail to a real client; it must look like it.
- Theme tokens only — `bg-background`, `text-muted-foreground`, `border-border`. No ad-hoc hex, no
  raw Tailwind palette classes on foundational surfaces.
- Every list has a designed empty, loading, and error state. A dashboard whose source was failing
  must say so, per the connector rules above.
- The frontend never talks to Postgres. It goes through `apps/api`.

## Claude API

Read the `claude-api` skill before writing or changing any model call. Model IDs and API shapes in
this section are current as of 2026-08-29; the skill is authoritative over anything recalled.

- Use `github.com/anthropics/anthropic-sdk-go`. Never raw HTTP, never an OpenAI-compatible shim.
  Where a Go binding is not documented in the skill, read it from the SDK source — do not infer it
  from the Python or cURL shape.
- **Model tiering** (ADR 0003 — cheap for triage, strong for execution):
  - routing, classification, dedup triage -> `claude-haiku-4-5`
  - extraction of tasks / events / commitments -> `claude-sonnet-5`
  - drafting replies, documents, reports -> `claude-opus-5`

  Use the exact ID strings. Never append a date suffix.
- **Routing resolves cheapest-first**: sender rule -> domain -> keyword -> model. A model call is the
  last resort, and every model-assigned route writes `signal_contexts.assigned_by = 'model'` with a
  confidence so it can be audited.
- Extraction uses **structured outputs** (`output_config.format`), not prose parsing. Commitment
  `direction` has exactly two values; there is no third case to handle.
- Use adaptive thinking (`thinking: {type: "adaptive"}`). `budget_tokens`, `temperature`, `top_p`,
  and assistant prefill are removed on these models and return 400.
- **Prompt caching is a cost requirement, not an optimization.** Stable prefix first (system prompt,
  tool list, context tone profile), volatile content last (the signal being processed). Assert
  `usage.cache_read_input_tokens > 0` in the extraction path — a silent cache miss is the most
  likely cause of a blown token budget.
- Backfills and re-extraction over historical signals go through the **Batch API** (50% cost). Only
  in-session work is latency-sensitive.
- Count tokens with `messages.count_tokens`. Never a character heuristic.
- **Never truncate a signal payload to fit a context window.** Chunk it, or surface it to the owner.
  Silent truncation produces confidently wrong commitments.
- Every `runs` row records `model` and `tokens_used`. Session token spend must be attributable.

## Security

- `accounts.credentials_enc` is encrypted at rest and never logged, never returned by an API
  response, never included in a prompt.
- Raw signal payloads are not logged above debug level. They contain other people's correspondence.
- No secrets in the repository. Local config via `.env`, which stays gitignored.

## Working style in this repo

- **Do not add infrastructure.** The system is one Go API, one Go worker, one Next.js app, Postgres,
  and Redis, on Docker Compose. No message broker, no separate search service, no third datastore.
  Ask before adding a dependency that runs as its own process.
- Prefer the standard library and the libraries already named in ADR 0005. A new Go module needs a
  reason beyond convenience.
- This is a single-user system. Do not build multi-user, teams, permissions, or billing. `user_id`
  columns exist so that stays a future option, not a current feature.
- Agents draft; the owner decides. Do not add a feature that removes the review step.
- If a task depends on an unresolved question from [docs/open-questions.md](docs/open-questions.md),
  pick a defensible default, mark it `TODO(open-question-N)`, and say which default you chose and why.

## Decided here, not in an ADR

Smaller conventions, free to change — just update this file.

- Primary keys are UUIDv7 (`uuid` columns), generated by the application, not the database.
- Enum-like columns are native Postgres `ENUM` types, declared in `00002_enums.sql`. Adding a value
  needs its own `-- +goose NO TRANSACTION` migration; a value can never be removed.
