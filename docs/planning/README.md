# Planning

## The backlog

**[`backlog.csv`](backlog.csv) is the source of truth.** Every feature and task in Warp, with its
real status. It is a CSV on purpose: a pull request can touch it, a review comment can point at a
line, and git can merge two people's changes.

| Column | Meaning |
|---|---|
| `ID` | Stable. Referenced by `Depends On` and by commit messages. |
| `Phase` | `0 Foundation`, `1 See`, `2 Understand`, `3 Draft`, `4 Act`, `Cross-cutting` — see §9 of the [context document](../warp-project-context.md). |
| `Area` | The part of the system it touches. |
| `Task` | One line. If it needs two, it is two rows. |
| `Description` | Why it exists and what "done" means. |
| `Status` | `Done`, `In Progress`, `Not Started`, `Blocked`, `Decision Needed`. |
| `Priority` | `P0` blocks the phase · `P1` needed for it to be usable · `P2` can follow · `P3` deferred. |
| `Depends On` | Comma-separated IDs. `OQ-n` refers to an [open question](../open-questions.md). |
| `Location / Evidence` | The file or command that proves the status. |

## The spreadsheet

[`warp-delivery-plan.xlsx`](warp-delivery-plan.xlsx) is a **generated view** — convenient to filter
and read, useless to review. It carries an Overview sheet with progress by phase, and the backlog
with dropdowns and filters.

```sh
make plan      # rebuild it from backlog.csv
```

Do not edit it. The next `make plan` discards the change, and git cannot merge it — `.gitattributes`
marks it binary so nobody tries.

It holds only Overview and Backlog. Open questions and architecture decisions already live in
[`docs/open-questions.md`](../open-questions.md) and [`docs/decisions/`](../decisions/); copying them
here would be a second place to keep in step, and it would fall behind.

## Rules for a row

**`Done` means verified, not finished-in-my-head.** Put the proof in *Location / Evidence*: a
passing test, an applied migration, a command that works. A reviewer should be able to re-check it
rather than trust it.

**`Blocked` means waiting on a decision, not waiting on effort.** Name the open question in
*Depends On*. If nothing is blocking it but you, it is `Not Started`.

**`In Progress` says which part is done.** `C-05` is the pattern: schema and pure helpers exist, no
adapter writes through them yet.

**Update the row in the same commit as the work.** Same habit as committing generated code beside
the source it came from — a status that lags is worse than no status, because it is trusted.

`make plan` validates the file before rendering: duplicate IDs, unknown statuses or priorities, and
dependencies pointing at rows that do not exist all fail with the line number.
