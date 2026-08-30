"use client"

import * as React from "react"
import { CheckIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ContextChip } from "@/components/warp/context-chip"
import { ReliabilityBadge } from "@/components/warp/reliability"
import { GoogleMark } from "@/components/warp/source-marks"
import { formatRelative, formatStamp } from "@/lib/format"
import { accounts, NOW } from "@/lib/mock/data"
import type { SyncResult, WorkEvent } from "@/lib/mock/types"

/**
 * Pull the calendar.
 *
 * Deltas only — the adapter carries a sync token and asks Google for what changed since
 * the last one. There is no "full re-fetch" button and there is not going to be: a full
 * mailbox or calendar re-fetch is a defect, not a fallback (CLAUDE.md, data conventions).
 *
 * The panel names every account feeding the calendar and its reliability tier, because a
 * sync that ran against a degraded source produced an incomplete answer and the owner has
 * to be able to see that without going looking.
 *
 * UI-only: `onSync` merges a fixture. The real one enqueues an asynq job and streams the
 * result back.
 */
export function GoogleSync({
  lastResult,
  onSync,
}: {
  lastResult: SyncResult | null
  onSync: () => WorkEvent[]
}) {
  const [running, setRunning] = React.useState(false)

  const calendarAccounts = accounts.filter(
    (account) => account.provider === "gcalendar" && account.status !== "disabled",
  )
  const degraded = calendarAccounts.filter(
    (account) => account.status === "needs_reauth" || account.status === "error",
  )

  const lastSyncAt =
    lastResult?.at ??
    calendarAccounts
      .map((account) => account.lastSyncAt)
      .filter((at): at is string => at !== null)
      .sort()
      .at(-1) ??
    null

  const run = () => {
    setRunning(true)
    // Stands in for the round trip. The button has to be able to look busy.
    window.setTimeout(() => {
      onSync()
      setRunning(false)
    }, 700)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline" className="gap-2">
            <span className="size-3.5 shrink-0">
              <GoogleMark />
            </span>
            Calendar sync
            {degraded.length > 0 ? (
              <TriangleAlertIcon className="text-destructive" />
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">Google Calendar</p>
          <p className="text-xs text-muted-foreground">
            {lastSyncAt
              ? `Last synced ${formatRelative(lastSyncAt, NOW)} · ${formatStamp(lastSyncAt)}`
              : "Never synced"}
          </p>
        </div>

        <div className="space-y-2">
          {calendarAccounts.map((account) => {
            const failing =
              account.status === "needs_reauth" || account.status === "error"
            return (
              <div key={account.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {account.displayName}
                  </p>
                  <ReliabilityBadge reliability={account.reliability} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {account.contextIds.map((id) => (
                    <ContextChip key={id} contextId={id} />
                  ))}
                </div>
                {failing ? (
                  <p className="text-xs text-destructive">{account.lastError}</p>
                ) : null}
              </div>
            )
          })}
        </div>

        <Separator />

        {lastResult ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 text-foreground">
              <CheckIcon className="size-3.5" /> {lastResult.fetched} change
              {lastResult.fetched === 1 ? "" : "s"} since the last token
            </p>
            <p>
              {lastResult.created} new · {lastResult.updated} updated ·{" "}
              {lastResult.unchanged} unchanged
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Incremental — Warp asks only for what changed since the stored sync token.
            There is no full re-fetch.
          </p>
        )}

        <Button size="sm" className="w-full" onClick={run} disabled={running}>
          <RefreshCwIcon className={running ? "animate-spin" : undefined} />
          {running ? "Syncing…" : "Sync now"}
        </Button>

        {degraded.length > 0 ? (
          <Badge variant="destructive" className="w-full justify-center font-normal">
            A source is failing — this schedule may be incomplete
          </Badge>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
