# Warp — Project Context

> The frame that holds everything together.

**Status:** design phase, no code written yet
**Type:** single-user personal system, built for the owner first
**Last updated:** 2026-08-29 (stack resolved — see docs/decisions/)

---

## 1. What this is

Warp is a personal work system for someone running several parallel lives at once — a
full-time company job, two remote contract jobs, a master's degree, and personal health
routines. Each of these has its own inbox traffic, its own deadlines, its own people, and
its own tone of communication. Today they all collide in the same head.

Warp does three things:

1. **Sees everything.** It ingests from email, calendar, files, and messaging platforms, and
   routes each incoming item to the life area it belongs to.
2. **Tracks what's owed.** Who promised what to whom, and what is still outstanding. This is
   the single highest-value function and the one nothing else does well.
3. **Does work on request.** When the owner clocks into a session, background agents draft
   replies, prepare documents, and update records — then hand everything to a review queue.

Warp is not a task manager. Task managers wait for you to type. Warp watches, decides what
matters, and acts within limits you set.

---

## 2. Who it's for

One user. The owner. Multi-user support is explicitly out of scope, but every table carries
`user_id` so the schema does not need rewriting later.

The owner's life areas, which map directly onto the `contexts` table:

| Area | Kind | Notes |
|---|---|---|
| Main company job | `work` | Primary employment |
| Remote job A | `work` | Contract, separate client, separate email thread |
| Remote job B | `work` | Contract, separate client |
| Master's degree | `study` | Coursework deadlines, supervisor correspondence |
| Self | `personal` | Parent context |
| — Sport | `personal` | Child of Self |
| — Fitness | `personal` | Child of Self |

Contexts nest. `Self > Sport` inherits defaults from `Self` unless overridden.

---

## 3. Design principles

These four decisions constrain everything downstream. Changing any of them means redesigning
the schema.

### 3.1 Signals are immutable

Everything arriving from the outside world is stored raw in `signals` and never modified.
Tasks, events, and commitments are all *derived* from signals. When extraction logic
improves, re-run it over historical signals and lose nothing.

### 3.2 Context is the central axis

Not projects, not tasks — contexts. Every signal, task, person, memory note, and autonomy
rule belongs to a context. This is what stops the system from using the tone reserved for a
manager when replying to a training partner, and stops coursework from surfacing during a
client work session.

### 3.3 Nothing reaches the outside world without a trace

Every action that leaves the system — sending an email, posting a message, writing to a
spreadsheet — passes through `proposed_actions`, then `executions`, carrying an undo
reference. There is no code path that sends something without a row recording it.

### 3.4 Trust is earned per action type, not granted globally

Autonomy is a property of the pair *(context, action type)*, not of the system. Drafting a
reply to remote job A can be automatic while drafting a reply to the main company job still
requires approval. Levels only rise on accumulated evidence.

---

## 4. Connector reality

This section exists because the naive assumption — "connect all my accounts" — is false, and
building on that assumption fails around week three.

| Source | API status | Reliability tier | Verdict |
|---|---|---|---|
| Gmail | Full official API | `official` | Build first |
| Google Calendar | Full official API | `official` | Build first |
| Google Drive | Full official API | `official` | Build first |
| Zalo OA (Official Account) | Official API, business accounts only | `official` | Phase 4 |
| Zalo personal | No official API | `unofficial` | Ban risk. Avoid. |
| Facebook Page / Messenger | Official API, pages only | `official` | Optional |
| Facebook personal messages | No API | — | Not possible |
| Instagram Business | Official Graph API | `official` | Optional |
| Instagram personal | No API | — | Not possible |
| Manual entry / email forwarding | Always available | `manual` | Fallback for everything |

Two consequences for the design:

- `accounts.reliability` is a first-class column. The UI must visibly mark which sources may
  be incomplete, so a daily report is never silently trusted when a source was down.
- Every context must work with `manual` sources alone. If a connector dies, the system
  degrades rather than breaks.

---

## 5. Architecture

```
External sources
  Gmail · Calendar · Drive · Zalo OA · manual entry
        |
        v
Adapters          normalize into signals, deduplicate by external_id
        |
        v
Router            assign each signal to one or more contexts
        |
        v
Extractor         derive tasks, events, commitments from signals
        |
        v
Core data         Postgres + pgvector  (the Work Graph)
        |
        v
Orchestrator      background agents run inside a session
        |
        v
Review queue      owner approves, edits, or rejects
        |
        v
Executor          performs the action, stores undo reference
        |
        v
Web app           dashboard, reminders, end-of-session report
```

Routing order, cheapest first: explicit sender rules, then domain match, then keyword match,
then a model call. Most traffic resolves before reaching the model, which keeps token cost
down and behaviour predictable.

---

## 6. Data model

Postgres 17 with the `pgvector` extension. All timestamps stored in UTC; converted to
`Asia/Ho_Chi_Minh` at the presentation layer only.

### 6.1 Foundation

**`users`**
Single row in practice. Present so multi-user is not a rewrite.

**`contexts`**
`id`, `user_id`, `parent_id` (self-referencing, nullable), `name`, `kind`
(`work` | `study` | `personal`), `active_hours` (jsonb), `tone_profile` (text),
`is_archived`, `created_at`.

The tree that organizes everything. `active_hours` lets the system stay quiet about
coursework at 10am on a workday.

**`accounts`**
`id`, `user_id`, `provider`, `reliability` (`official` | `unofficial` | `manual`),
`display_name`, `credentials_enc` (jsonb, encrypted at rest), `status`, `last_sync_at`,
`last_error`.

**`account_contexts`**
Join table. `account_id`, `context_id`. One Gmail account can feed several contexts — the
router decides per signal which one applies.

**`routing_rules`**
`id`, `context_id`, `match_type` (`sender` | `domain` | `keyword` | `thread`),
`match_value`, `priority`, `is_active`.

**`signals`**
`id`, `account_id`, `external_id`, `kind` (`email` | `message` | `calendar_event` | `file`),
`payload` (jsonb, raw), `content_hash`, `occurred_at`, `ingested_at`, `processed_at`.

Immutable. Unique index on `(account_id, external_id)` for idempotent ingestion.

**`signal_contexts`**
`signal_id`, `context_id`, `confidence` (float), `assigned_by` (`rule` | `model` | `manual`).

**`people`**
`id`, `user_id`, `display_name`, `notes`, `created_at`.

**`identities`**
`id`, `person_id`, `provider`, `handle`, `verified`. Links one person across email address,
Zalo ID, and phone number.

### 6.2 Derived work items

**`tasks`**
`id`, `context_id`, `source_signal_id`, `title`, `detail`, `status`
(`open` | `in_progress` | `blocked` | `done` | `dropped`), `owner` (`me` | `agent`),
`priority`, `due_at`, `estimated_minutes`, `created_at`, `completed_at`.

**`events`**
`id`, `context_id`, `source_signal_id`, `external_calendar_id`, `title`, `start_at`,
`end_at`, `location`, `person_id`, `status`.

**`commitments`**
`id`, `context_id`, `person_id`, `direction` (`i_owe` | `owed_to_me`), `what`,
`evidence_signal_id`, `promised_at`, `due_at`, `status`
(`open` | `fulfilled` | `waived` | `overdue`).

The highest-value table in the system. Things do not get dropped because they are difficult;
they get dropped because they are forgotten. `direction` has exactly two values and no third
case exists.

**`reminders`**
`id`, `target_type` (`task` | `event` | `commitment`), `target_id`, `remind_at`, `channel`,
`status`, `sent_at`.

**`metrics`**
`id`, `context_id`, `metric`, `value`, `unit`, `recorded_at`. Generic table serving the
sport and fitness contexts — running distance, gym sessions, weight, sleep.

### 6.3 Memory (the Work Graph)

**`memory_notes`**
`id`, `context_id`, `subject_type` (`person` | `project` | `self`), `subject_id`, `content`,
`source_signal_id`, `confidence`, `embedding vector(1536)`, `created_at`, `last_used_at`.

Accumulates facts such as *"the contact at remote job B needs PDF attachments, not links"*.
Retrieved by similarity and injected into agent prompts. This is the asset that makes the
system progressively more useful and would take a replacement months to rebuild.

### 6.4 Execution and control

**`work_sessions`**
`id`, `user_id`, `mode`, `context_ids` (jsonb array), `started_at`, `ended_at`,
`tokens_used`, `actions_proposed`, `actions_approved`.

The clock-in switch. A session scopes which contexts agents may touch. Agents do not run
outside a session.

**`runs`**
`id`, `session_id`, `task_id`, `action_type`, `autonomy_level_applied`, `model`, `status`,
`tokens_used`, `started_at`, `ended_at`, `error`.

**`run_steps`**
`id`, `run_id`, `step_no`, `tool`, `input` (jsonb), `output` (jsonb), `duration_ms`.
Debugging trail. Without this, agent failures are unexplainable.

**`proposed_actions`**
`id`, `run_id`, `kind` (`send_email` | `send_message` | `create_event` | `update_record`),
`payload` (jsonb), `payload_edited` (jsonb, nullable), `status`
(`pending` | `approved` | `edited` | `rejected` | `expired`), `reviewed_at`.

The gap between `payload` and `payload_edited` is the most valuable training signal
available — it shows exactly where the model's judgment diverged from the owner's.

**`executions`**
`id`, `proposed_action_id`, `executed_at`, `result`, `external_ref`, `undo_token`,
`undone_at`.

**`autonomy_rules`**
`id`, `context_id`, `action_type`, `level` (`ask` | `draft` | `auto`), `updated_at`.
Everything defaults to `draft`.

**`autonomy_evidence`**
`id`, `rule_id`, `proposed_action_id`, `outcome`
(`approved_unchanged` | `edited` | `rejected`), `created_at`.

After a threshold of consecutive `approved_unchanged` outcomes, the system proposes raising
the level. The owner never has to trust the system up front — trust is granted incrementally
against evidence.

**`reports`**
`id`, `session_id`, `period`, `content_md`, `generated_at`.

**`audit_log`**
`id`, `entity_type`, `entity_id`, `action`, `actor` (`user` | `agent` | `system`),
`diff` (jsonb), `created_at`.

---

## 7. The session model

Clocking in is the central interaction.

1. Owner opens the app and starts a session, selecting one or more contexts —
   for example *Remote job A + Remote job B*.
2. The system syncs only accounts mapped to those contexts.
3. New signals are routed and extracted.
4. Tasks eligible for agent handling are queued as runs, subject to the autonomy rule for
   their `(context, action_type)` pair.
5. Agents produce `proposed_actions`. Nothing is sent.
6. The owner reviews in batch — approve, edit, or reject.
7. Approved actions execute and record an undo reference.
8. Closing the session generates a report: what was done, what is waiting, what is blocked,
   what is due next.

Coursework and fitness contexts stay untouched during a work session. This separation is the
main reason contexts exist.

---

## 8. Tech stack

Deliberately boring. One user does not justify distributed anything.

- **Database:** Postgres 17 with `pgvector`. No separate vector database.
- **Queue:** Redis.
- **Backend:** Go with Echo v4 — one API service plus one worker process. pgx and sqlc for data
  access, goose for migrations, asynq for the queue. See
  [ADR 0005](decisions/0005-backend-framework.md), which supersedes the earlier FastAPI-or-NestJS
  note.
- **Frontend:** Next.js App Router with React, TypeScript, Tailwind v4, shadcn/ui, and Magic UI.
  See [ADR 0006](decisions/0006-frontend-stack.md).
- **API contract:** OpenAPI 3.1 in `docs/api/openapi.yaml`, with the Echo server interfaces and the
  TypeScript client both generated from it. Go and TypeScript cannot share types by construction, so
  the spec is what keeps the two halves honest.
- **Model:** Claude API. Cheap model for routing and triage, strong model for execution — tiers fixed
  in [ADR 0003](decisions/0003-model-tiering.md).
- **Deployment:** Docker Compose on a single VPS.

Cost control: sync deltas only, never full re-fetches. Resolve routing with rules before
calling a model. Cache extraction results keyed on `content_hash`.

---

## 9. Build phases

**Phase 1 — See.**
Contexts, accounts, signals, ingestion from Gmail and Calendar, a timeline view. No AI at
all. If this is not reliable, everything built on top of it is worthless.

**Phase 2 — Understand.**
Extraction into tasks, events, and commitments. Reminders. This is already a usable product
and the point at which the system starts saving real time.

**Phase 3 — Draft.**
Work sessions, runs, proposed actions. Autonomy hard-locked at `draft`. No `auto` level
exists in the code yet.

**Phase 4 — Act.**
Enable the autonomy ladder. Add Zalo OA. Nothing here starts until phases 1–3 have run
against real traffic for several weeks.

---

## 10. Non-goals

- Multi-user, teams, permissions, or billing
- A mobile app before the web app is proven
- Unofficial platform integrations that risk account bans
- Replacing judgment, relationships, or creative work — agents draft, the owner decides
- Anything approaching a general-purpose assistant for all industries

---

## 11. Open questions

1. What is the confidence threshold below which a signal goes to a manual routing queue
   instead of being auto-assigned?
2. How many consecutive clean approvals should trigger an autonomy upgrade proposal — and
   should the threshold differ by how damaging the action is?
3. Should commitments be extracted automatically, or confirmed by the owner on first
   detection until precision is measured?
4. Retention: how long are raw signal payloads kept before being pruned to metadata?
5. What is the acceptable monthly token budget, and what does the system do when it is
   exceeded mid-session?

---

## 12. Naming

Product name **Warp** — in weaving, the warp is the set of lengthwise threads held under
tension on the loom, the frame every other thread is woven into. The product is not the
weaver; it is the frame that keeps things straight.

Repository, database, and namespace: `warp`.
One-line description: *Warp — the frame that holds everything together.*
