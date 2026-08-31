"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { GoogleMark } from "@/components/warp/source-marks"

/**
 * Sign in with the same Google account Warp already reads Gmail, Calendar and Drive
 * from.
 *
 * This is not a social login in the usual sense — it does not open the system to anyone
 * holding a Google account. It is pinned to the one account the owner connected, and the
 * API rejects any other `sub` claim before a session is issued. The point is that it adds
 * no new way in: it reuses the identity Warp already depends on for its primary
 * connectors, and removes a passphrase from the picture.
 */
export function GoogleButton({
  label = "Continue with Google",
  returnTo = "/",
  onStart,
}: {
  label?: string
  /** Where to land afterwards. The API rejects anything that is not a local path. */
  returnTo?: string
  onStart?: () => void
}) {
  // A real navigation, not a fetch. The browser has to *leave* for Google's consent
  // screen and come back to the callback, and the callback is what sets the session
  // cookie — an XHR could neither follow the redirect chain nor receive the cookie.
  const start = () => {
    onStart?.()
    // Not an internal page, so the lint rule below does not apply: this path is
    // rewritten to the Go API, which answers 302 to Google's consent screen.
    // `router.push` would try to render it as a route and the sign-in would never
    // leave the app.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/v1/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-10 w-full"
      onClick={start}
    >
      <span className="size-4 shrink-0">
        <GoogleMark />
      </span>
      {label}
    </Button>
  )
}

/** `or` rule between the Google path and the passphrase path. */
export function OrDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
