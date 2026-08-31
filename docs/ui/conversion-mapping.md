# Web surface — conversion mapping

How each domain concept becomes a screen, and which component layer owns it. Written
alongside the first UI pass (2026-08-30). UI only: every screen renders from
`apps/web/src/lib/mock/`, and no screen calls an API.

Rules that produced this mapping live in [CLAUDE.md](../../CLAUDE.md) and
[ADR 0006](../decisions/0006-frontend-stack.md); vocabulary comes from
[glossary.md](../glossary.md) and is used verbatim in the interface.

---

## 1. Route ↔ domain

| Route | Screen | Reads | Owns the interaction |
|---|---|---|---|
| `/login` | Sign in | `users` | Google (pinned to the owner's account) or a passphrase. No emailed reset. |
| `/register` | Create account | `users` | Provisions the one owner. The API closes the route once it exists. |
| `/` | Dashboard | `proposed_actions`, `commitments`, `signals`, `events`, `tasks`, `work_sessions` | **Review queue** — approve / edit / reject. The most-used interaction in the product. |
| `/work-items` | Work items | `tasks`, `commitments` | Filter by context and status; create, edit, and resolve either kind; task detail in a `Sheet` with its source signal. |
| `/schedule` | Schedule | `events`, `tasks.due_at`, `commitments.due_at` | Two modes — agenda, or a week/month grid. Create and edit events; pull Google Calendar. |
| `/audit-log` | Audit log | `audit_log` | Filter by actor; expand a row for the `diff`. |
| `/reports` | Reports | `reports` | Pick a report; read it. |
| `/settings` | Contexts | `contexts`, `accounts`, `autonomy_rules` | Edit name, active hours, tone profile. |
| `/settings/connections` | Connections | `accounts`, `account_contexts` | Connect, re-authorise, disconnect. |
| `/settings/autonomy` | Autonomy | `autonomy_rules`, `autonomy_evidence` | Raise a level, against evidence. |

**Events are not on Work items.** Tasks, events, and commitments are all derived work
items, but events are read against a clock rather than scanned as a list — so tasks and
commitments share Work items, and events anchor Schedule.

## 2. Concept ↔ component

Every operational surface is a shadcn primitive on Base UI. No styled `div` stands in for
one.

| Concept | Component | Why this one |
|---|---|---|
| Signal timeline | `Card` + `SignalRow` | Dense rows, routing source and confidence inline. |
| Review queue | `article` + `Textarea` + `AlertDialog` | Keyboard-first batch work; approval is a confirm, not a click. |
| Task list | `Table` → `Sheet` | Scannable at a glance, whole record one click away. |
| Create / edit | `Sheet` form per kind | Mirrors the table's `CHECK` constraints, so the UI cannot assemble a row Postgres would refuse. |
| Row actions | `DropdownMenu` | Status moves without opening the record. Labels must sit in a `DropdownMenuGroup` — Base UI throws otherwise. |
| Date entry | `datetime-local` through `lib/format` | The field is naive wall time; the conversion is pinned to the owner zone, not the browser's. |
| Commitments board | Two columns by `direction` | Two values, no third case — the split *is* the model. |
| Agenda | Grouped `ul` per owner-local day | Answers "what is coming": time is the index, empty hours cost nothing. |
| Calendar — week | Absolute blocks over a 24 h axis | Answers "where does this fit": duration and free space drawn to scale. |
| Calendar — month | 6 × 7 grid, 3 entries a cell | Shape of a month. Overflow is counted, never silently clipped. |
| Active hours | `Card` beside both modes | The rule that decides what the schedule is allowed to show. |
| Calendar sync | `Popover` + `GoogleSync` | Delta only. Names every feeding account and its reliability tier — a sync against a degraded source produced an incomplete answer. |
| Event form | `Sheet` + `EventForm` | Local write, or a queued proposed action when the record also lives on Google. |
| Audit entry | Expandable row + `dl` diff | Read after the fact: dense list, full before/after on demand. |
| Report | Four fixed sections | Done / Waiting / Blocked / Due next, always in that order. |
| Context | `ContextChip` — dot + name | Repeated on nearly every row; a filled pill would read as an alert. |
| Reliability | `ReliabilityBadge` + `DegradedSourceNotice` | `accounts.reliability` surfaced wherever derived data is shown. |
| Connector identity | Vendor marks in `source-marks.tsx` | Settings → Connections only. Picking an account is the one place a logo carries information. |
| Autonomy level | `AutonomyBadge` + `Progress` | Evidence is the argument for a level, so it sits beside it. |
| Navigation | `Sidebar` + `Command` (⌘K) | Long sittings; changing context should not need the mouse. |
| Session scope | `live` marker on the sidebar's context list | The rule deciding what agents may touch, shown next to the contexts it governs — read from `SessionProvider`, so clocking out clears it. |
| Context filter | Sidebar rows toggle `?contexts=` | Multi-select, held in the URL, carried across navigation. Selecting a parent covers its children. Empty means every context. |
| Context creation | `Sheet` + `ContextForm` | Name, kind, nesting, active hours, tone profile. Slug follows the name and is validated against `contexts_slug_format`. |
| Outbound / destructive | `AlertDialog` | Never `Dialog`. Approving sends real mail to a real client. |

## 3. Where Magic UI applies — and where it was cut

ADR 0006 allows Magic UI in three places: session clock-in and clock-out, the
end-of-session report, and empty states. The login screen is a fourth, and the only one —
see §3.1.

| Used | Where | What it does |
|---|---|---|
| `TextAnimate` | Report heading | Marks the session as closed; this is the summary of it. |
| `BlurFade` | Report sections, empty states | Four sections settling in reading order; a list that rendered rather than failed. |
| `KineticText` | Login — logotype | Hover-only letter weighting. An affordance, not an animation. |

Cut after being built and looked at, each for the same reason — **motion must never gate
content, and decoration must never sit on a surface read daily**:

| Cut | Was | Why |
|---|---|---|
| `NumberTicker` | Dashboard stat cards, header token count | A ticker mid-animation, or one whose observer never fires, shows a confident `0`. These four numbers are the first thing read each morning. |
| `AnimatedList` | Incoming signals | Reveals one item per tick; the panel is empty on arrival and stays partial for seconds. |
| `Meteors` | Login — right panel | Falling specks behind a password field. It said nothing, and made the screen look less serious rather than more. |
| `AnimatedBeam`, `DotPattern` | Login — ingest figure | Six vendor logos on animated beams is the stock connect-your-apps diagram, and it was selling integrations to the one person who already owns the system. Six vendors also meant six visual languages in six circles — the thing that made the screen read as generic. |

The motion that stayed runs on mount rather than on intersection, so no content depends on
an `IntersectionObserver` firing.

There are no gradient backgrounds, beams, or glassmorphism on any operational surface.

### 3.1 The auth screens are the one decorative surface

CLAUDE.md bans animated backgrounds and beams on the surfaces read every day, and that is
unchanged for all of them — dashboard, work items, schedule, audit log, reports, settings.
`/login` and `/register` sit outside that set: seconds of attention, no operational data,
no decision made from them. They share one shell — `app/(auth)/layout.tsx` — so the panel
is written once.

Even there, the decoration is the product rather than an effect on top of it. The left
panel is a field of warp threads — the metaphor the product is named for (context doc §12),
where the warp is the set of lengthwise threads held under tension and every other thread
is woven into it. Seven of the threads are lit in the context kind colours, grouped the way
the contexts actually nest: three work threads together, one study thread, then a family of
three personal ones. It says *several parallel lives held in one frame* without a logo, an
arrow, or a sentence of explanation, and **nothing about it moves**.

It replaced an integration diagram that was cut for the reasons in the table above. The
brand marks built for that diagram were not thrown away — they moved to Settings →
Connections, which is the one screen where a vendor logo is the right call: the owner is
picking a real account at a real company, and a mail envelope does not distinguish Gmail
from anything else.

The panel carries the app's dark tokens whatever the viewer's theme — the `dark` class
redefines the custom properties on that element, so `--border` and `--context-work` inside
it are the dark ones and nothing is hard-coded.

There is no photograph. A stock image is the least specific thing this screen could say.

One Magic UI component was edited on the way in and will be reverted by re-running the
CLI — reapply it: `dot-pattern` had `Math.random()` during render, which the React
Compiler lint rejects as impure. It has since been deleted along with the diagram, but
`warp-threads` uses the same integer-mixing seed for its thread jitter, for the same
reason: the weave has to be identical on the server and the client.

### 3.2 Colour

One rule: **a hue means exactly one thing, everywhere.** Colour is the scarcest signal on
a dense screen, and it only works while it is scarce.

| Hue | Means | Where |
|---|---|---|
| `destructive` | Already late, failed, or about to destroy something | Overdue dates, a blocked task, a failing account, `AlertDialog` confirmations |
| `warning` | Worth a look, not broken | `DegradedSourceNotice`, medium-risk actions, the `unofficial` reliability tier |
| `context-work` / `-study` / `-personal` | Which life area | Context markers and calendar blocks only |
| neutral | Everything else | |

Red had been doing five jobs: validation errors, failures, overdue dates, *"may be
incomplete"*, and the `i_owe` direction. The last two were the damage.

- **"May be incomplete" is not a failure.** It says the answer may be short. It is amber,
  which is why the `warning` token exists — without it that state lands on red and red
  stops meaning anything.
- **`i_owe` is a category, not an alarm.** Roughly half of all commitments carry it, so
  painting half the board red is how a reader stops seeing red at all. Direction now reads
  through weight — solid for what you owe, outlined for what is owed to you — and on the
  commitments board the only red left is the one commitment that is actually overdue.
- **Risk is a scale**, so its three steps have to be separable: muted, amber, red. Low and
  medium were both outlined chips, which made the scale decorative.

### 3.3 Order

Lists are ordered by how soon they bite, not by how they were modelled. The dashboard
tiles read **Overdue · Awaiting review · Due today · I owe**: what is already late, what
needs a decision now, what lands today, then the standing total. An earlier order led with
the total, which is the one number that does not change what you do next.

## 4. Invariants the interface has to hold

Schema invariants are enforced in the API and the database. These are the ones the *UI*
can quietly break, and how each is held:

1. **Nothing leaves without a trace.** No screen has a send control. The only path
   outward is the review queue, and its confirm names the recipient and the undo window.
   The calendar is the sharpest case: an event with an `external_calendar_id` lives on a
   calendar other people can see, so editing it is an outbound action. The event form
   saves nothing to Google — it queues a `proposed_action` and says so, and its footer
   button reads *Queue change for review* instead of *Save*. Creating a local event may
   also queue a `create_event` action, never perform one.
2. **Context is the axis.** Every row carries a `ContextChip`; the session bar shows the
   contexts agents may touch; the tone profile applied to a draft is printed under it.
3. **A failing source is visible.** `DegradedSourceNotice` sits above the data it
   qualifies — on the dashboard, work items, the schedule, and inside any report
   generated while a source was down.
4. **`auto` is unreachable.** The badge renders it as `auto — locked`; the promotion
   control only offers `ask → draft`; a rule already at `draft` with its evidence met
   shows a lock explaining it is waiting on phase 4.
5. **UTC in, Asia/Ho_Chi_Minh out.** Conversion happens only in
   [`src/lib/format.ts`](../../apps/web/src/lib/format.ts). `now` is a parameter
   everywhere, never `Date.now()`, so the server and client renders agree. The calendar
   positions everything by *day key* — `YYYY-MM-DD` already resolved to the owner's zone
   — and does plain date arithmetic on it. Re-applying a timezone to a day key is how
   calendars land a day out on either side of a DST boundary.
6. **A hand-written record never looks derived.** A task created by hand is saved with no
   `source_signal_id` and its detail sheet says so; a commitment recorded by hand has no
   evidence and reads *recorded by hand* wherever it appears. Editing changes the derived
   record only — the signal behind it is immutable and re-extraction has to stay possible.
7. **A derived date never looks like an agreed one.** In the week grid a calendar event
   is a solid block and a task or commitment deadline is dashed; in the month grid the
   dot is filled or hollow. A deadline that reads as a meeting gets treated like one.

## 5. States

Every list ships all three (`src/components/warp/states.tsx`): `EmptyState`,
`ListSkeleton`, `ErrorState` — plus route-level `loading.tsx`, `error.tsx`, and a
`not-found.tsx`. Empty copy explains the *system reason* the list is empty rather than
inviting the owner to add a row by hand: work items are derived, not typed.

## 6. What this pass does not include

- No API calls. When `docs/api/openapi.yaml` generates a client into `lib/api/`,
  `src/lib/mock/` is deleted and its types are replaced by generated ones.
- No dark-mode switch. Tokens for both themes exist in `globals.css`; nothing toggles
  `.dark` at the root yet — the login panel scopes it to one element deliberately.
- No auth. `/login` and `/register` navigate to `/` and set nothing. The Google button
  runs no OAuth flow; pinning the grant to a single `sub` is an API concern.
