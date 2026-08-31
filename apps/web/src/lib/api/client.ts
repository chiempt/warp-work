import createClient from "openapi-fetch"

import type { paths } from "./schema"

/**
 * The browser's API client.
 *
 * Typed from `docs/api/openapi.yaml` — `pnpm api:types` regenerates
 * `schema.d.ts`, and nothing in `lib/api` is written by hand. Go and TypeScript
 * cannot share types by construction, so the spec is the only thing keeping the
 * two halves honest: a handler that drifts from it fails to compile on one side
 * and fails to typecheck on the other.
 *
 * Base URL is this app's own origin, which `next.config.ts` rewrites to the API.
 * That is what makes the `HttpOnly` session cookie travel without CORS.
 */
export const api = createClient<paths>({
  baseUrl: "/",
  credentials: "same-origin",
})
