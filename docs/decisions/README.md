# Architecture decisions

One file per decision, numbered, never deleted. A decision that turns out wrong gets a new record
that supersedes it — the old one stays, because the reasoning that led there is worth keeping.

**Format:** `NNNN-short-title.md`, with these sections:

```
# NNNN. Title

**Status:** Proposed | Accepted | Superseded by NNNN | Open
**Date:** YYYY-MM-DD

## Context
What forced a decision.

## Decision
What was decided, in the active voice.

## Consequences
What this makes easy, what it makes hard, and what it forecloses.
```

Write an ADR when a choice would be expensive to reverse, when it constrains later work, or when a
future reader would otherwise ask "why on earth is it like this". Do not write one for choices that
a single commit could undo.

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-postgres-as-only-datastore.md) | Postgres with pgvector as the only datastore | Accepted |
| [0003](0003-model-tiering.md) | Three-tier Claude model assignment | Accepted |
| [0004](0004-monorepo-layout.md) | Single repository, `apps/` layout | Accepted |
| [0005](0005-backend-framework.md) | Go with Echo for the backend | Accepted |
| [0006](0006-frontend-stack.md) | Next.js with shadcn/ui and Magic UI | Accepted |
| [0007](0007-openapi-with-ogen.md) | Spec-first with ogen, and Echo keeps the outside | Accepted |
| [0008](0008-authentication.md) | Authentication: provider identities, revocable sessions | Accepted |
