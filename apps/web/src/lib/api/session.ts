import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type { components } from "./schema"

export type CurrentSession = components["schemas"]["CurrentSession"]

/** Must match `sessionCookieName` in apps/api/internal/httpapi/auth.go. */
const SESSION_COOKIE = "warp_session"

/**
 * Server-side code talks to the API directly. The rewrite in `next.config.ts` exists for
 * the browser; a Server Component fetching its own origin would loop back through Next
 * for no reason.
 */
const apiOrigin = process.env.WARP_API_ORIGIN ?? "http://localhost:8080"

type SessionResult =
  | { state: "authenticated"; session: CurrentSession }
  | { state: "anonymous" }
  /** The API could not answer. Not the same as "not signed in" — see `requireSession`. */
  | { state: "unavailable"; reason: string }

/**
 * Ask the API who the caller is, forwarding their cookie.
 *
 * `cache: "no-store"` because a session is per-request and revocable: a cached answer
 * would keep a revoked session alive for as long as the cache lived.
 */
export async function getCurrentSession(): Promise<SessionResult> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)

  if (!token) {
    return { state: "anonymous" }
  }

  let response: Response
  try {
    response = await fetch(`${apiOrigin}/api/v1/auth/session`, {
      headers: { cookie: `${SESSION_COOKIE}=${token.value}` },
      cache: "no-store",
    })
  } catch (error) {
    return {
      state: "unavailable",
      reason: error instanceof Error ? error.message : "the API did not answer",
    }
  }

  if (response.ok) {
    return { state: "authenticated", session: (await response.json()) as CurrentSession }
  }
  if (response.status === 401) {
    return { state: "anonymous" }
  }
  return { state: "unavailable", reason: `the API answered ${response.status}` }
}

/**
 * The gate on every authenticated route. Redirects to /login when the caller is not
 * signed in.
 *
 * This is routing, not security. The real boundary is the API: every endpoint carries
 * the `sessionCookie` scheme, and a request without a live session is refused there
 * whatever this function decides. That distinction matters for the third branch below.
 *
 * When the API cannot answer — it is down, or `getCurrentSession` is described by the
 * contract but not implemented yet — this lets a request through *if it carries a
 * cookie at all*. It is not proof of anything, and it is not treated as proof: the page
 * renders, and every call it makes is still refused by the API unless the cookie is
 * real. Failing closed here would instead bounce a correctly signed-in owner back to a
 * login page that just signed them in, which is a loop, not a safeguard.
 */
export async function requireSession(): Promise<CurrentSession | null> {
  const result = await getCurrentSession()

  if (result.state === "anonymous") {
    redirect("/login")
  }
  if (result.state === "authenticated") {
    return result.session
  }
  return null
}

/** The inverse gate: /login and /register are pointless once signed in. */
export async function redirectIfSignedIn(): Promise<void> {
  const result = await getCurrentSession()
  if (result.state === "authenticated") {
    redirect("/")
  }
}
