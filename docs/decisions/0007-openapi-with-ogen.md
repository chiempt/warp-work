# 0007. Spec-first with ogen, and Echo keeps the outside

**Status:** Accepted
**Date:** 2026-08-30
**Amends:** [ADR 0005](0005-backend-framework.md), which named `oapi-codegen`

## Context

The backend is Go and the frontend is TypeScript, so API types cannot be shared by construction —
ADR 0005 accepted that cost on the condition that the OpenAPI document becomes the source of truth
rather than documentation written after the fact. That condition only holds if drifting from the
spec is *impossible*, not merely discouraged.

`oapi-codegen` generates Echo-shaped interfaces but leaves request validation to the handler: a
parameter the spec declares as a required uuid arrives as whatever the client sent. The spec then
describes an API the server does not actually enforce, which is the failure this decision exists to
prevent.

## Decision

**ogen** generates the server from `docs/api/openapi.yaml`: its own router, typed parameters, and
validation derived from the schema — no reflection at runtime, no struct tags.

**Echo keeps the outside.** It owns request ids, structured logging, panic recovery, the body limit,
the operational endpoints (`/healthz`, `/readyz`), and the documentation endpoints. Everything under
`/api/v1` is handed to the generated server wholesale, mounted with `echo.WrapHandler`. Routes are
not declared in Go; they are declared in the spec.

The generated handler interface is embedded through `api.UnimplementedHandler`, so an operation that
exists in the contract but has no implementation answers **501**, not a compile error. The whole
contract can be published before any of it is built, and adding an operation to the spec can never
break the build.

The document itself is embedded in the binary and served at `/openapi.yaml`, with Swagger UI over it
at `/docs` from embedded assets.

## Consequences

Validation stops being handler code. `GET /signals` requires `contextIds`, a context id must be a
uuid, and `limit` cannot exceed 200 — all rejected by generated code before a handler runs, because
the spec says so. Hard invariant 2 — *there is no unfiltered signal listing* — is now enforced by the
contract rather than by everyone remembering it.

Errors still leave in one envelope. ogen routes handler errors through `NewError`, and requests it
rejects before an operation through the configured error handler; both produce
`{"error":{"code","message"}}`, so a client keeps exactly one error branch. One wrinkle worth
knowing: ogen deliberately sends `ht.ErrNotImplemented` to the *error handler* rather than to
`NewError`, so that path has to classify it itself or an unwritten operation reports as a client
mistake.

Serving the spec from the binary means a deployed service cannot document something other than what
it runs, and `make openapi-check` fails the build if the generated code is stale. Swagger UI's assets
are embedded too: the page works with no internet, and no CDN learns which endpoints are read.

The cost is a heavier generator with a larger dependency tree (it pulls in OpenTelemetry), and
generated code that is verbose to read. Neither is paid at runtime, and neither is paid by hand.
