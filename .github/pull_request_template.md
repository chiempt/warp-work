## What this changes

<!-- One or two sentences. Reference a backlog ID where one applies, e.g. A-07. -->

## Why

<!-- What problem it solves. If it changes a hard invariant, an ADR, or CLAUDE.md, say so here. -->

## Checks

- [ ] `make check` passes (vet, tests, generated code not stale)
- [ ] Generated code committed alongside the source it came from, if any changed
- [ ] `docs/planning/backlog.csv` updated in this commit, with proof in *Location / Evidence*
- [ ] API change: declared in `docs/api/openapi.yaml` first, both sides regenerated
- [ ] Schema change: new migration, `Down` verified by rolling down and back up
- [ ] None of the seven rules in [CONTRIBUTING.md](../CONTRIBUTING.md) is broken

## How it was verified

<!-- A command that shows it working, or the test that covers it. "It compiles" is not verification. -->
