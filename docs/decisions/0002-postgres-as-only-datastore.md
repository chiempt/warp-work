# 0002. Postgres with pgvector as the only datastore

**Status:** Accepted
**Date:** 2026-08-29

## Context

Warp needs relational data (contexts, signals, commitments), full-text-ish matching for routing, and
vector similarity for memory-note retrieval. The reflexive architecture adds a dedicated vector
database alongside Postgres.

One user generates on the order of thousands of signals per month and a memory corpus in the low
tens of thousands of rows. That is nowhere near the scale where a specialised vector store earns its
operational cost.

## Decision

Postgres 17 with the `pgvector` extension holds everything. Redis is present only as a queue, and
holds no state that matters after a restart.

## Consequences

One backup, one connection pool, one thing to keep running on the VPS. Memory retrieval can join
against `contexts` and `people` in a single query rather than reconciling two stores — which matters,
because memory notes are always retrieved *within a context*.

The cost: if the memory corpus grows past what an HNSW index on a single box serves comfortably, this
is a migration rather than a config change. Accepted — that threshold is years away at one user, and
a system that never reaches it should never have paid for a second datastore.

Redis holding no durable state is what makes this safe. If queue state ever becomes load-bearing,
this ADR needs revisiting.
