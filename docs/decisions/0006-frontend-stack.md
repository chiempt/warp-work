# 0006. Next.js with shadcn/ui and Magic UI

**Status:** Accepted
**Date:** 2026-08-29

## Context

The frontend is a single-user operational surface: a timeline of signals, a commitments board, a
review queue, and an end-of-session report. It is used daily, for long stretches, to make decisions
about other people's expectations — density and legibility matter more than anything else.

The owner chose React with Next.js and [Magic UI](https://magicui.design). Magic UI is distributed as
a shadcn registry, so shadcn/ui comes with it as the base layer rather than as a competing choice.

## Decision

Next.js App Router, React, TypeScript, Tailwind v4, shadcn/ui as the component foundation, Magic UI
as an additional registry on top of it.

Configuration as scaffolded, recorded here so it is not re-decided per screen:

- Next.js 16 App Router with the React Compiler, React 19, TypeScript, Tailwind v4, pnpm.
- shadcn style `base-nova` on **Base UI** primitives (`@base-ui/react`) — not Radix. Component APIs
  therefore follow Base UI's docs; do not mix in `@radix-ui/*` packages.
- Base colour `neutral`, CSS variables on, Lucide icons, `motion` for animation.
- Magic UI as a namespaced registry in `apps/web/components.json`:

  ```json
  "registries": { "@magicui": "https://magicui.design/r/{name}" }
  ```

  then `pnpm dlx shadcn@latest add @magicui/<component>`.

**Where each layer applies.** shadcn primitives own every operational surface — the timeline, the
review queue, the commitments board, tables, forms, dialogs. Magic UI is for the small number of
places where motion carries meaning rather than decoration: the session clock-in and clock-out
transition, the end-of-session report, and empty states.

## Consequences

Owning the component source means the review queue can be tuned for keyboard-first batch approval —
the single most-used interaction in the product — without fighting a library's opinions.

The risk this takes on is aesthetic drift. Magic UI's catalogue is built for marketing pages:
gradients, beams, animated backgrounds. Applied to a dashboard the owner reads every morning, that
becomes noise that costs attention on every visit. Hence the split above, and the standing rule in
CLAUDE.md: an animation that does not communicate state does not ship.

A destructive or outbound action never gets a decorative treatment. Approving a proposed action sends
mail to a client; it uses `AlertDialog` and looks like what it is.
