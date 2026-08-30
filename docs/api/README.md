# API contract

`openapi.yaml` is the source of truth for the HTTP API. It is written before the handler, never
extracted from one.

## What is generated from it

| Side | Tool | Output | Command |
|---|---|---|---|
| Go server | [ogen](https://github.com/ogen-go/ogen) | `apps/api/internal/api/` | `make openapi` |
| TypeScript client | *not wired yet* | `apps/web/src/lib/api/` | — |

Generated code is committed, in the same commit as the spec change that produced it. `make check`
runs `openapi-check`, which regenerates and fails if the result differs from what is committed.

## Where it is served

| Path | What |
|---|---|
| `/docs` | Swagger UI, from embedded assets — works offline |
| `/openapi.yaml` | the document itself, embedded in the binary |

The spec is embedded rather than read from disk, so a deployed service cannot document something
other than what it runs.

## Rules the contract enforces

Two rules from [CLAUDE.md](../../CLAUDE.md) are enforced here rather than by convention, because
generated validation runs before any handler does:

- **Every read is context-scoped.** `GET /signals` requires `contextIds`. There is no way to ask
  this API for everything at once.
- **Raw payloads never leave.** `Signal` carries `subject` and `snippet`, never `payload`.

## Adding an operation

1. Add it to `openapi.yaml` with an `operationId`.
2. `make openapi`.
3. It answers **501** immediately — `Handler` embeds `api.UnimplementedHandler`, so the contract can
   be published in full before any of it is built, and a new operation never breaks the build.
4. Implement the method on `Handler` in `apps/api/internal/httpapi/`, which shadows the stub.

Never hand-write anything under `apps/api/internal/api/`.
