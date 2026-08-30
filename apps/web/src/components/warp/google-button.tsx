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
  onStart,
}: {
  label?: string
  onStart?: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-10 w-full"
      onClick={onStart}
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
