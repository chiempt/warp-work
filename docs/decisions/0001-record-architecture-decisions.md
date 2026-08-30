# 0001. Record architecture decisions

**Status:** Accepted
**Date:** 2026-08-29

## Context

Warp is a single-person system built in phases over months, with long gaps between sessions. The
context document records *what* the design is, but not *why* alternatives were rejected. Without
that, past decisions get relitigated — or worse, quietly reversed by someone (including the author,
or an agent) who no longer remembers the constraint that produced them.

## Decision

Record every consequential architecture decision as a numbered file in `docs/decisions/`. Never
delete or rewrite one; supersede it with a new record.

## Consequences

Reversing a decision costs one file and a status line, which is cheap. The discipline is the point:
if a change cannot be justified in an ADR, it probably has not been thought through. The overhead is
real but small, and it falls entirely on decisions that were going to be expensive anyway.
