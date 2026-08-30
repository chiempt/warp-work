"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { contextDot, contextTone } from "@/components/warp/context-chip"
import { cn } from "@/lib/utils"
import {
  dayOfMonth,
  formatTime,
  keyWeekday,
  monthGrid,
  ownerDayKey,
  sameMonth,
} from "@/lib/format"
import { byDay } from "@/lib/schedule"
import type { ScheduleEntry } from "@/lib/schedule"
import { contextById } from "@/lib/mock/data"

const VISIBLE_PER_DAY = 3

/**
 * The month grid. Six whole weeks, Monday-first, spilling either side of the month so
 * every row is a real week.
 *
 * A month cell cannot show duration, so it does not pretend to: entries are one line
 * each, time first, and anything past the third is counted rather than truncated — a
 * silently clipped day is how a deadline goes missing.
 */
export function ScheduleMonth({
  anchor,
  entries,
  now,
  onSelect,
}: {
  anchor: string
  entries: ScheduleEntry[]
  now: string
  onSelect: (entry: ScheduleEntry) => void
}) {
  const cells = monthGrid(anchor)
  const grouped = byDay(entries)
  const todayKey = ownerDayKey(now)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Same reason as the week grid: seven columns keep their minimum and scroll. */}
      <div className="overflow-x-auto">
        <div className="min-w-[48rem]">
      <div className="grid grid-cols-7 border-b border-border">
        {cells.slice(0, 7).map((day) => (
          <div
            key={day}
            className="border-r border-border py-2 text-center text-[11px] tracking-wide text-muted-foreground uppercase last:border-r-0"
          >
            {keyWeekday(day)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const dayEntries = grouped.get(day) ?? []
          const shown = dayEntries.slice(0, VISIBLE_PER_DAY)
          const hidden = dayEntries.length - shown.length
          const outside = !sameMonth(day, anchor)
          const isToday = day === todayKey

          return (
            <div
              key={day}
              className={cn(
                "min-h-26 border-r border-b border-border p-1.5 last:border-r-0",
                outside && "bg-muted/30",
              )}
            >
              <p
                className={cn(
                  "mb-1 flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                  !isToday && outside && "text-muted-foreground/60",
                  !isToday && !outside && "text-muted-foreground",
                )}
              >
                {dayOfMonth(day)}
              </p>

              <div className="space-y-0.5">
                {shown.map((entry) => (
                  <MonthEntry
                    key={`${entry.kind}-${entry.id}`}
                    entry={entry}
                    onSelect={onSelect}
                  />
                ))}
                {hidden > 0 ? (
                  <p className="pl-1 text-[10px] text-muted-foreground">
                    +{hidden} more
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
        </div>
      </div>
    </div>
  )
}

function MonthEntry({
  entry,
  onSelect,
}: {
  entry: ScheduleEntry
  onSelect: (entry: ScheduleEntry) => void
}) {
  const context = contextById.get(entry.contextId)
  const derived = entry.kind !== "event"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className="flex w-full cursor-pointer items-center gap-1 rounded px-1 py-px text-left hover:bg-muted"
          >
            {/* Filled for a calendar event, hollow for a date Warp derived — the same
                distinction the week grid draws with a dashed border. */}
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                derived
                  ? cn("bg-transparent ring-1 ring-current", contextTone(entry.contextId).text)
                  : contextDot(entry.contextId),
              )}
            />
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatTime(entry.startAt)}
            </span>
            <span className="truncate text-[11px]">{entry.title}</span>
          </button>
        }
      />
      <TooltipContent className="max-w-64 space-y-0.5">
        <p className="font-medium">{entry.title}</p>
        <p className="text-muted-foreground">
          {formatTime(entry.startAt)}
          {entry.endAt ? `–${formatTime(entry.endAt)}` : ""} · {context?.name}
        </p>
        {entry.meta ? <p className="text-muted-foreground">{entry.meta}</p> : null}
        <p className="text-muted-foreground">
          {entry.kind === "event" ? "Calendar event" : "Derived from a signal"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
