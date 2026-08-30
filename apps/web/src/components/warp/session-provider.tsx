"use client"

import * as React from "react"

import { openSession } from "@/lib/mock/data"
import type { WorkSession } from "@/lib/mock/types"

interface SessionState {
  session: WorkSession | null
  /** Contexts the open session may touch. Empty when nothing is clocked in. */
  scope: string[]
  start: (contextIds: string[]) => void
  end: () => void
}

const SessionContext = React.createContext<SessionState | null>(null)

/**
 * The clock-in, lifted out of the top bar.
 *
 * A session is not a property of the header that happens to draw it — it decides which
 * contexts agents may read and act in, so every surface that lists contexts needs to know
 * it. Holding it in one place is what lets the sidebar mark the contexts in scope
 * *truthfully*: a copy of `openSession` read straight from the fixtures would keep
 * claiming a scope after the owner clocked out, which is worse than showing nothing.
 *
 * UI-only: state lives here. It becomes the `work_sessions` resource when the API lands.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<WorkSession | null>(openSession)

  const value = React.useMemo<SessionState>(
    () => ({
      session,
      scope: session?.contextIds ?? [],
      start: (contextIds) => setSession({ ...openSession, contextIds }),
      end: () => setSession(null),
    }),
    [session],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionState {
  const value = React.useContext(SessionContext)
  if (value === null) {
    throw new Error("useSession must be used inside <SessionProvider>")
  }
  return value
}
