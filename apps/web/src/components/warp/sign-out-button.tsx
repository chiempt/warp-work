"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, LogOutIcon } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api/client"

/**
 * Signing out is a request, not a link.
 *
 * The session cookie is `HttpOnly`, so nothing here can clear it — only the API can,
 * and only by revoking the session row behind it. Navigating to /login instead would
 * leave a live session in the database and a working cookie in the browser: the owner
 * would look signed out and be signed in.
 */
export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const signOut = async () => {
    setPending(true)
    await api.DELETE("/api/v1/auth/session", {})

    // Sent regardless of the answer. If the API refused, the cookie is still there
    // and the gate will say so — but staying on a page the owner has asked to leave
    // is worse than landing on a sign-in screen that may bounce them back.
    router.replace("/login")
    router.refresh()
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            aria-label="Sign out"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50 group-data-[collapsible=icon]:hidden"
          >
            {pending ? (
              <LoaderCircleIcon className="size-3.5 animate-spin" />
            ) : (
              <LogOutIcon className="size-3.5" />
            )}
          </button>
        }
      />
      <TooltipContent side="right">Sign out</TooltipContent>
    </Tooltip>
  )
}
