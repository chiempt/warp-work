# 0008. Authentication: provider identities, revocable sessions

**Status:** Accepted
**Date:** 2026-08-30

## Context

Warp had no authentication of any kind: `users` carried `email`, `display_name`, and `timezone`, and
nothing else. Every endpoint was unauthenticated, and the OpenAPI document declared no security
scheme at all — the contract stated the API was public.

This also blocked Phase 1. The read endpoints need a `user_id`, and the only alternatives to a
session were hard-coding the owner's id or querying for the single row in `users` — both of which
are placeholders that survive far longer than intended.

Three existing tables look like they might already answer this. None does:

- **`accounts`** is a *source of signals*. One Google account produces three rows — `gmail`,
  `gcalendar`, `gdrive` — so "which one is the login" has no answer. Worse, its columns are sync
  concerns (`sync_cursor`, `last_sync_at`, `status`), and `account_status` includes `needs_reauth`:
  a connector needing re-consent would present as the owner being signed out. Disconnecting Gmail
  would lock them out entirely.
- **`identities`** is a *contact's* handles, with `person_id NOT NULL`. Using it would mean putting
  the owner into `people` — but `people` are the counterparties in `commitments`, which has
  `direction` of `i_owe` or `owed_to_me`. The owner would be able to owe themselves.
- **`work_sessions`** is the clock-in, carrying a token budget. It is a business concept that
  happens to share a word with HTTP sessions.

## Decision

`users` is split in two. The root keeps only `id` and its timestamps — around a hundred foreign keys
point at that row, so it holds nothing that could ever need rewriting. `user_profiles` holds
everything describing the person, keyed by `user_id` so exactly one profile per user is structural
rather than remembered.

Then two new tables, prefixed `auth_` so they are never confused with the three above.

**`auth_providers`** — plural by force as well as by convention, since the singular name belongs to
the enum and a table cannot share a name with a type. One row per way in: `(kind, subject)`, unique. A table rather than
columns on `users`, because a single way in is a single point of lockout: lose the Google account
and there is no administrator to appeal to. A `BEFORE DELETE` trigger refuses to remove the last
one.

`subject` is the provider's immutable identifier — Google's `sub`, a passkey's credential id —
**never the email**. An email can be reassigned at the provider, and matching on it would hand the
account to whoever inherits the address. `auth_providers.email` records what the provider reported
and is display-only; `user_profiles.email` stays canonical.

The `auth_provider_kind` enum ships as `google | zalo | facebook | passkey`, though only `google` is
implemented first. Values are cheap now and awkward later: extending a Postgres enum needs
`ALTER TYPE ... ADD VALUE` in its own no-transaction migration.

**`auth_sessions`** — server-side and revocable, storing only `sha256` of the token. A stateless
token cannot be withdrawn: a lost laptop would mean waiting out the expiry or rotating the signing
key for everything. A database dump must not be enough to sign in.

**Google Sign-In as the first provider**, because the Google OAuth client has to exist anyway for
the Gmail and Calendar connectors. Nothing secret gets stored: no password hash, no reset flow, no
brute-force rate limiting to get right.

**Login and connector authorization stay separate flows.** Login asks for `openid email profile`.
The connector asks for Gmail/Calendar scopes with `access_type=offline`, and its refresh token goes
to `accounts.credentials_enc`. Their lifetimes are opposite: a login session is short and tied to
the owner being present, while a connector token must keep working unattended for months so the
worker can sync at 3am. One consent screen for both would mean every sign-in re-issues connector
tokens, and revoking a session kills background sync.

## Consequences

Handlers get `user_id` from the session, which unblocks the Phase 1 read endpoints without a
placeholder.

Two database-enforced rules rather than remembered ones, on the same reasoning as the immutability
trigger on `signals`: the last sign-in method cannot be deleted, and at most one identity per user
is primary. A rule whose violation is unrecoverable belongs in the database.

The contract has to change before the code: `securitySchemes`, a global `security`, `401` on every
operation, and exemptions for `/healthz`, `/readyz`, and the sign-in endpoints themselves.

Zalo and Facebook are in the enum, but **Zalo Login and Facebook Login are products distinct from
their messaging APIs**. Signing in with Zalo will not make Zalo personal messages readable — that
remains impossible and out of scope, per §4 of the context document. The enum value must not be read
as a connector promise.

What this accepts: a dependency on Google being reachable to sign in. The mitigation is the second
identity — a passkey — which is why the table exists at all.
