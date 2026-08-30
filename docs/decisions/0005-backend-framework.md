# 0005. Go with Echo for the backend

**Status:** Accepted
**Date:** 2026-08-29
**Amends:** context document §8, which named FastAPI or NestJS

## Context

The context document left the backend to familiarity, on the grounds that nothing in the design
depends on the choice. That remains true of the architecture and false of the day-to-day: the choice
fixes the language for the api, the worker, the migration tooling, and the Anthropic SDK, and it is
effectively irreversible once Phase 1 ships.

The owner chose Go with [Echo](https://echo.labstack.com/). Neither of the two options named in the
context document was selected, so this record supersedes that line.

## Decision

**Go with Echo v4** for `apps/api` and `apps/worker`. Supporting libraries, chosen once so they are
not relitigated per package:

| Concern | Choice |
|---|---|
| HTTP | `github.com/labstack/echo/v4` |
| Postgres driver | `github.com/jackc/pgx/v5` (no ORM) |
| Query layer | [sqlc](https://sqlc.dev) — typed Go generated from hand-written SQL |
| Migrations | `github.com/pressly/goose/v3` |
| Queue | `github.com/hibiken/asynq` (Redis-backed, with retries and a scheduler) |
| Vector type | `github.com/pgvector/pgvector-go` |
| UUIDv7 | `github.com/google/uuid` (`uuid.NewV7`) |
| Logging | `log/slog`, JSON handler |
| Claude | `github.com/anthropics/anthropic-sdk-go` |
| API contract | OpenAPI 3.1 + `oapi-codegen` (Echo server interfaces, TypeScript client) |

## Consequences

**What this makes easy.** The worker is the part of Warp that benefits most: adapters polling several
providers, extraction fanning out over signals, and agent runs are all concurrent, long-lived, and
I/O-bound. Goroutines and context cancellation handle that without an async runtime to reason about.
Deployment is a static binary in a scratch container, which suits one VPS. sqlc plus goose satisfies
the standing rule that migrations are the only place schema is defined — there is no ORM that could
quietly diverge from it.

**What this makes hard, and the mitigation.** The backend and `apps/web` are now different languages,
so API types cannot be shared by construction. This is the real cost of choosing Go over TypeScript,
and it is paid by making the contract explicit: `docs/api/openapi.yaml` is the source of truth, the
Echo handler interfaces and the frontend's TypeScript client are both generated from it, and a
handler that does not match the spec fails to compile. Hand-writing either side is a defect.

**What it forecloses.** Nothing in the data model or the phase plan. The router and extractor stay
pure functions taking a signal and returning a decision, which is as expressible in Go as anywhere.

The Anthropic Go SDK is less exercised than the Python and TypeScript ones. Where a binding is not
documented, read it from the SDK source rather than inferring it from another language's shape.
