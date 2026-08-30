# API contract

`openapi.yaml` is the source of truth for the HTTP API. It does not exist yet — it is written before
the first Echo handler, not extracted from one.

Both sides are generated from it:

- **Go** — `oapi-codegen` produces Echo server interfaces into `apps/api/internal/`. A handler that
  does not satisfy the generated interface fails to compile.
- **TypeScript** — the client in `apps/web/lib/api/`, never hand-edited.

Go and TypeScript cannot share types by construction ([ADR 0005](../decisions/0005-backend-framework.md)),
so this file is the only thing keeping the two halves honest. Changing an endpoint means changing the
spec first, regenerating both sides, and committing all three together.
