# 0003. Three-tier Claude model assignment

**Status:** Accepted
**Date:** 2026-08-29

## Context

The context document specifies "cheap model for routing and triage, strong model for execution" but
names no models. Token spend is an open question (§11.5) and the system processes every incoming
signal, so the per-signal cost floor determines whether Warp is affordable at all.

Three workloads with different economics:

- **Routing** — high volume, one classification per signal, short input, tiny output. Most signals
  never reach a model at all: sender, domain, and keyword rules resolve first.
- **Extraction** — moderate volume, structured output over one signal, correctness matters because a
  missed commitment is the failure mode the whole system exists to prevent.
- **Drafting** — low volume, only inside a work session, and the output goes out under the owner's
  name to a client or a supervisor.

## Decision

| Workload | Model | Rate (in / out per MTok) |
|---|---|---|
| Routing, classification, dedup triage | `claude-haiku-4-5` | $1 / $5 |
| Extraction of tasks, events, commitments | `claude-sonnet-5` | $2 / $10 |
| Drafting replies, documents, reports | `claude-opus-5` | $5 / $25 |

With three supporting requirements:

- Rules resolve routing before any model call. The model is the last branch, not the first.
- Extraction uses structured outputs and is cached on `content_hash`, so a re-run of unchanged
  signals costs nothing.
- Historical backfills go through the Batch API at 50%.

## Consequences

The expensive model only ever runs on work the owner asked for, inside a session, and its output is
reviewed before it leaves the system — so the blast radius of a bad draft is a rejected proposal.

Extraction sits at the middle tier deliberately: it runs unattended, and its errors are silent. If
measured precision on commitments is unacceptable, the answer is to raise this tier to
`claude-opus-5` for commitments specifically, not to add a verification pass — see open question 3.

The risk this accepts is that routing at the cheapest tier occasionally misfiles a signal into the
wrong context. That is why `signal_contexts` carries `confidence` and `assigned_by`, and why open
question 1 (the manual-routing threshold) has to be answered before Phase 2 ships.
