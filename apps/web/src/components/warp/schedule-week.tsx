"use client"

import * as React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { contextTone } from "@/components/warp/context-chip"
import { cn } from "@/lib/utils"
import {
  addDays,
  dayOfMonth,
  formatTime,
  hourLabel,
  keyWeekday,
  ownerDayKey,
  ownerMinutes,
} from "@/lib/format"
import { assignLanes, byDay, durationMinutes } from "@/lib/schedule"
import type { ScheduleEntry } from "@/lib/schedule"
import { contextById } from "@/lib/mock/data"

const HOUR_HEIGHT = 48
const DAY_MINUTES = 24 * 60
/** Where the grid is scrolled on arrival — the owner's earliest active hour. */
const OPENING_HOUR = 6

/**
 * The week grid: a time axis, seven day columns, blocks positioned by when they happen.
 *
 * Events are solid — someone else can see them on their own calendar. Task due dates and
 * commitment deadlines are dashed, because they are dates Warp *derived* from a signal
 * and nobody else agreed to them. Losing that distinction would turn a deadline into a
 * meeting, which is exactly the mistake the commitments table exists to prevent.
 */
export function ScheduleWeek({
  weekStart,
  entries,
  now,
  onSelect,
}: {
  weekStart: string
  entries: ScheduleEntry[]
  now: string
  onSelect: (entry: ScheduleEntry) => void
}) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const grouped = byDay(entries)
  const todayKey = ownerDayKey(now)
  const nowMinutes = ownerMinutes(now)

  React.useEffect(() => {
    // Open on the working day, not on midnight. A ref write, not state — this must not
    // re-render, and it must not animate.
    if (scroller.current) {
      scroller.current.scrollTop = OPENING_HOUR * HOUR_HEIGHT
    }
  }, [weekStart])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Seven columns and a time gutter do not fit a phone. The grid keeps its minimum
          and scrolls sideways inside its own container rather than squeezing columns to
          the point where nothing in them can be read. */}
      <div className="overflow-x-auto">
        <div className="min-w-[48rem]">
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0 border-r border-border" />
        {days.map((day) => {
          const isToday = day === todayKey
          return (
            <div
              key={day}
              className="flex-1 border-r border-border py-2 text-center last:border-r-0"
            >
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {keyWeekday(day)}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  isToday
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {dayOfMonth(day)}
              </p>
            </div>
          )
        })}
      </div>

      <div ref={scroller} className="max-h-[34rem] overflow-y-auto">
        <div className="flex">
          <div className="w-14 shrink-0 border-r border-border">
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="relative border-b border-border/60 last:border-b-0"
              >
                <span className="absolute -top-2 right-1.5 bg-card px-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {hour === 0 ? "" : hourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const placed = assignLanes(grouped.get(day) ?? [])
            return (
              <div
                key={day}
                className="relative flex-1 border-r border-border last:border-r-0"
                style={{ height: 24 * HOUR_HEIGHT }}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    style={{ height: HOUR_HEIGHT }}
                    className="border-b border-border/60 last:border-b-0"
                  />
                ))}

                {day === todayKey ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: (nowMinutes / DAY_MINUTES) * 24 * HOUR_HEIGHT }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                ) : null}

                {placed.map(({ entry, lane, lanes }) => (
                  <EntryBlock
                    key={`${entry.kind}-${entry.id}`}
                    entry={entry}
                    lane={lane}
                    lanes={lanes}
                    now={now}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}

function EntryBlock({
  entry,
  lane,
  lanes,
  now,
  onSelect,
}: {
  entry: ScheduleEntry
  lane: number
  lanes: number
  now: string
  onSelect: (entry: ScheduleEntry) => void
}) {
  const tone = contextTone(entry.contextId)
  const start = ownerMinutes(entry.startAt)
  const minutes = durationMinutes(entry)
  const derived = entry.kind !== "event"
  const past = entry.startAt < now
  const context = contextById.get(entry.contextId)
  const height = Math.max(18, (minutes / DAY_MINUTES) * 24 * HOUR_HEIGHT - 2)
  // A block three-across, or shorter than two lines, cannot show a time as well as a
  // title. The title is the one that identifies it; the time is already the position.
  const roomForTime = lanes <= 2 && height >= 34

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className={cn(
              "absolute z-10 cursor-pointer overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left hover:brightness-110",
              tone.block,
              tone.edge,
              derived && "border border-dashed border-l-2 bg-transparent",
              derived && tone.edge,
              past && "opacity-55",
            )}
            style={{
              top: (start / DAY_MINUTES) * 24 * HOUR_HEIGHT,
              height,
              left: `calc(${(lane / lanes) * 100}% + 2px)`,
              width: `calc(${100 / lanes}% - 4px)`,
            }}
          >
            <p className="truncate text-[11px] leading-tight font-medium">
              {entry.title}
            </p>
            {roomForTime ? (
              <p className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
                {formatTime(entry.startAt)}
                {entry.endAt ? `–${formatTime(entry.endAt)}` : ""}
              </p>
            ) : null}
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
          {entry.kind === "event"
            ? entry.tentative
              ? "Calendar event · tentative"
              : "Calendar event"
            : entry.kind === "task"
              ? "Task due — derived from a signal"
              : "Commitment deadline — derived from a signal"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
