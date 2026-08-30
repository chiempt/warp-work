# Glossary

Warp's domain vocabulary. These words have exactly one meaning in this repository — in code, in the
database, and in the interface. If you are about to introduce a synonym, use the term here instead.

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Signal** | One immutable item as it arrived from the outside world: an email, a message, a calendar event, a file. Stored raw and never modified. | A task. A signal may produce zero, one, or several tasks — or none at all. |
| **Context** | A life area — a job, a degree, a health routine. The central axis of the system; everything belongs to exactly one. Contexts nest and inherit. | A project. Contexts are long-lived and few; projects come and go and are not modelled. |
| **Account** | A connected source of signals, with a reliability tier. | A person. One person may write from several accounts; one account may carry many people. |
| **Person** | A human the owner deals with, reachable through one or more **identities** (email address, Zalo ID, phone number). | A user. There is exactly one user — the owner. |
| **Task** | Something to be done, derived from a signal. Has an owner: `me` or `agent`. | A commitment. A task is work; a commitment is a promise. |
| **Commitment** | A promise, in one of two directions: `i_owe` or `owed_to_me`. The highest-value record in the system. | A task or a reminder. A commitment records that something was promised, with the signal that proves it. |
| **Reminder** | A scheduled nudge pointing at a task, event, or commitment. | The thing it points at. |
| **Memory note** | An accumulated fact about a person, project, or the owner, retrieved by similarity and injected into agent prompts. *"The contact at remote job B needs PDF attachments, not links."* | A task or a note-to-self. Memory notes are inputs to prompts, never work items. |
| **Work session** | The clock-in. Scopes which contexts agents may touch and for how long. Agents do not run outside one. | A login, or an HTTP session. |
| **Run** | One agent execution inside a session, against one task, at one autonomy level. Broken into **run steps** — the tool-call debugging trail. | A job or a queue message. |
| **Proposed action** | A pending outbound action awaiting review: send email, send message, create event, update record. Carries the original payload and the owner's edit, if any. | An execution. Nothing has left the system yet. |
| **Execution** | A proposed action that was approved and performed, with an external reference and an undo token. | A proposed action. This one actually happened. |
| **Autonomy level** | `ask`, `draft`, or `auto` — a property of the pair *(context, action type)*, never of the system. Defaults to `draft`. | A permission or a role. There is one user; this is about trust, not access. |
| **Autonomy evidence** | The outcome of a reviewed proposed action — `approved_unchanged`, `edited`, or `rejected` — accumulated to justify raising a level. | An audit log entry. Evidence is about trust; the audit log is about accountability. |
| **Router** | The step assigning each signal to one or more contexts, resolving cheapest-first: sender rule, domain, keyword, then a model call. | The extractor, which runs after it. |
| **Extractor** | The step deriving tasks, events, and commitments from a routed signal. Pure and re-runnable. | The router. |
| **Adapter** | Per-provider ingestion code that normalises an external item into a signal and deduplicates by external id. | A connector, informally the same thing — prefer *adapter* in code, *connector* in prose about the platform. |
| **Reliability tier** | `official`, `unofficial`, or `manual` — how much a source can be trusted to be complete. Surfaced in the UI wherever derived data is shown. | Account status, which is about whether it is working right now. |
| **Work Graph** | The accumulated corpus of memory notes, commitments, and people. The asset a replacement system would take months to rebuild. | The database as a whole. |
| **Report** | The end-of-session summary: what was done, what waits, what is blocked, what is due next. | A dashboard. |
| **OA** | Zalo Official Account — the only Zalo surface with an official API. | A Zalo personal account, which has no API and is permanently out of scope. |
