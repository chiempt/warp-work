import {
  CalendarOffIcon,
  ClockIcon,
  HandshakeIcon,
  ListChecksIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ContextChip } from "@/components/warp/context-chip"
import { EmptyState } from "@/components/warp/states"
import { cn } from "@/lib/utils"
import { formatDayLong, formatRelative, formatTime, ownerDayKey } from "@/lib/format"
import { byDay, durationMinutes } from "@/lib/schedule"
import type { ScheduleEntry } from "@/lib/schedule"

const icons = {
  event: ClockIcon,
  task: ListChecksIcon,
  commitment: HandshakeIcon,
} as const

/**
 * The agenda: everything on one clock, read in the order it arrives.
 *
 * This is the mode for the question "what is coming". The calendar answers "where does
 * this fit", which is a different question and needs a grid.
 */
export function ScheduleAgenda({
  entries,
  now,
  horizonDays,
}: {
  entries: ScheduleEntry[]
  now: string
  horizonDays: number
}) {
  const days = byDay(entries)
  const todayKey = ownerDayKey(now)

  if (days.size === 0) {
    return (
      <EmptyState
        icon={CalendarOffIcon}
        title="Nothing on the horizon"
        description={`No events, due dates, or commitment deadlines fall inside the next ${horizonDays} days.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      {[...days.entries()].map(([day, dayEntries]) => (
        <section key={day} className="space-y-2">
          <header className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">
              {formatDayLong(dayEntries[0].startAt)}
            </h2>
            {day === todayKey ? (
              <Badge variant="secondary" className="font-normal">
                today
              </Badge>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {dayEntries.length} item{dayEntries.length === 1 ? "" : "s"}
            </span>
          </header>

          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {dayEntries.map((entry) => {
              const Icon = icons[entry.kind]
              const past = entry.startAt < now
              const isEvent = entry.kind === "event"
              return (
                <li
                  key={`${entry.kind}-${entry.id}`}
                  className={cn(
                    "flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
                    past && "opacity-60",
                  )}
                >
                  <span className="w-12 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatTime(entry.startAt)}
                  </span>
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isEvent ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", isEvent ? "font-medium" : "font-normal")}>
                      {entry.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ContextChip contextId={entry.contextId} showParent />
                      {entry.endAt ? (
                        <span className="text-xs text-muted-foreground">
                          {durationMinutes(entry)} min
                        </span>
                      ) : null}
                      {entry.meta ? (
                        <span className="text-xs text-muted-foreground">
                          {entry.meta}
                        </span>
                      ) : null}
                      {entry.tentative ? (
                        <span className="text-xs text-muted-foreground">tentative</span>
                      ) : null}
                      {!isEvent ? (
                        <Badge variant="ghost" className="font-normal">
                          {entry.kind === "task" ? "due" : "deadline"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatRelative(entry.startAt, now)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
