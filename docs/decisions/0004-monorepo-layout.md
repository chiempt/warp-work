# 0004. Single repository, `apps/` layout

**Status:** Accepted
**Date:** 2026-08-29

## Context

Warp is one API service, one worker, and one frontend, deployed together by Docker Compose onto a
single VPS. The api and the worker share the entire domain model — contexts, signals, the routing
rules — and always deploy at the same version.

## Decision

One repository. `apps/api`, `apps/worker`, `apps/web`, with schema in `db/` and no service owning
migrations.

## Consequences

A schema change and the code on both sides of it land in one commit and one review. There is no
version skew between the api and the worker, because there is no separate release.

The worker cannot be scaled or deployed independently of the api. At one user this is not a
constraint; the moment it becomes one, the split is mechanical because the two already share only the
data layer and never each other's handlers.

`apps/web` is a separate build with no database access, so it could move out later without touching
the backend.
