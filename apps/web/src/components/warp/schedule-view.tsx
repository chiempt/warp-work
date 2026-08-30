"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  PlusIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActiveHours } from "@/components/warp/active-hours"
import { EventForm } from "@/components/warp/event-form"
import { GoogleSync } from "@/components/warp/google-sync"
import { ScheduleAgenda } from "@/components/warp/schedule-agenda"
import { ScheduleMonth } from "@/components/warp/schedule-month"
import { ScheduleWeek } from "@/components/warp/schedule-week"
import {
  addDays,
  keyDayMonth,
  keyMonthYear,
  ownerDayKey,
  startOfMonth,
  startOfWeek,
} from "@/lib/format"
import { scheduleEntries } from "@/lib/schedule"
import type { ScheduleEntry } from "@/lib/schedule"
import { events as seedEvents, incomingGoogleEvents, NOW } from "@/lib/mock/data"
import type { SyncResult, WorkEvent } from "@/lib/mock/types"

const AGENDA_HORIZON_DAYS = 7

type Mode = "agenda" | "calendar"
type Range = "week" | "month"

/**
 * Two modes, because there are two questions.
 *
 * **Agenda** answers "what is coming" — one clock, in order, over a fixed horizon. It is
 * the mode that matters on a working morning, and it stays the default.
 *
 * **Calendar** answers "where does this fit" — a grid, with duration and empty space
 * drawn to scale. That is the question you have when someone asks for an hour on Tuesday,
 * and a list cannot answer it.
 *
 * Both read the same entries from `lib/schedule`. The calendar is not a second source of
 * truth; it is the same three tables on a different axis.
 */
export function ScheduleView({
  initialMode = "agenda",
  initialRange = "week",
}: {
  initialMode?: string
  initialRange?: string
}) {
  const [mode, setMode] = React.useState<Mode>(
    initialMode === "calendar" ? "calendar" : "agenda",
  )
  const [range, setRange] = React.useState<Range>(
    initialRange === "month" ? "month" : "week",
  )
  const [anchor, setAnchor] = React.useState(() => ownerDayKey(NOW))

  const router = useRouter()
  const [eventList, setEventList] = React.useState<WorkEvent[]>(seedEvents)
  const [lastSync, setLastSync] = React.useState<SyncResult | null>(null)
  const [queued, setQueued] = React.useState<string | null>(null)
  const [eventForm, setEventForm] = React.useState<{
    open: boolean
    event: WorkEvent | null
  }>({ open: false, event: null })
  const created = React.useRef(0)

  const all = React.useMemo(
    () => scheduleEntries({ events: eventList }),
    [eventList],
  )

  const upsertEvent = (event: WorkEvent) =>
    setEventList((current) =>
      event.id === ""
        ? [...current, { ...event, id: `evt-manual-${++created.current}` }]
        : current.map((item) => (item.id === event.id ? event : item)),
    )

  /**
   * An outbound calendar write. It does not go out — it becomes a `proposed_action` and
   * waits in the review queue, like every other thing that leaves the system.
   */
  const proposeCalendarWrite = (event: WorkEvent, kind: "create" | "update") =>
    setQueued(
      `${kind === "create" ? "Create" : "Update"} “${event.title}” on Google Calendar — queued for review. Nothing has been sent.`,
    )

  /** Delta fetch: merge what changed, count what did not. */
  const sync = () => {
    const known = new Set(eventList.map((event) => event.id))
    const fresh = incomingGoogleEvents.filter((event) => !known.has(event.id))
    setEventList((current) => [...current, ...fresh])
    setLastSync({
      at: NOW,
      fetched: incomingGoogleEvents.length,
      created: fresh.length,
      updated: 0,
      unchanged: incomingGoogleEvents.length - fresh.length,
    })
    return fresh
  }

  const openEntry = (entry: ScheduleEntry) => {
    if (entry.kind === "event") {
      const event = eventList.find((item) => item.id === entry.id)
      if (event) setEventForm({ open: true, event })
      return
    }
    // Tasks and commitments are edited where they live.
    router.push(
      `/work-items?tab=${entry.kind === "task" ? "tasks" : "commitments"}`,
    )
  }
  const todayKey = ownerDayKey(NOW)

  const weekStart = startOfWeek(anchor)
  const monthStart = startOfMonth(anchor)

  const visible = React.useMemo(() => {
    if (mode === "agenda") {
      const horizon = new Date(
        new Date(NOW).getTime() + AGENDA_HORIZON_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
      return all.filter((entry) => entry.startAt <= horizon)
    }
    if (range === "week") {
      const from = weekStart
      const to = addDays(weekStart, 7)
      return all.filter((entry) => {
        const key = ownerDayKey(entry.startAt)
        return key >= from && key < to
      })
    }
    return all
  }, [all, mode, range, weekStart])

  const step = (direction: 1 | -1) =>
    setAnchor((current) =>
      range === "week"
        ? addDays(current, 7 * direction)
        : addDays(startOfMonth(current), direction > 0 ? 32 : -1),
    )

  const title =
    range === "week"
      ? `${keyDayMonth(weekStart)} – ${keyDayMonth(addDays(weekStart, 6))}`
      : keyMonthYear(monthStart)

  const showingToday =
    range === "week"
      ? startOfWeek(todayKey) === weekStart
      : startOfMonth(todayKey) === monthStart

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode((value as Mode) ?? "agenda")}
        >
          <TabsList>
            <TabsTrigger value="agenda">
              <ListIcon /> Agenda
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDaysIcon /> Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "calendar" ? (
          <>
            <Tabs
              value={range}
              onValueChange={(value) => setRange((value as Range) ?? "week")}
            >
              <TabsList variant="line">
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={range === "week" ? "Previous week" : "Previous month"}
                onClick={() => step(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={showingToday}
                onClick={() => setAnchor(todayKey)}
              >
                Today
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={range === "week" ? "Next week" : "Next month"}
                onClick={() => step(1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>

            <p className="text-sm font-medium tabular-nums">{title}</p>
          </>
        ) : (
          <Badge variant="outline" className="font-normal">
            next {AGENDA_HORIZON_DAYS} days
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <GoogleSync lastResult={lastSync} onSync={sync} />
          <Button size="sm" onClick={() => setEventForm({ open: true, event: null })}>
            <PlusIcon /> New event
          </Button>
        </div>
      </div>

      {queued ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm"
        >
          <p className="flex-1 text-muted-foreground">{queued}</p>
          <Button size="xs" variant="ghost" onClick={() => setQueued(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Active hours belongs beside the schedule in both modes — it is the rule that
          explains what the schedule is allowed to show. It drops below the content
          rather than squeezing the grid once the viewport cannot hold both. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          {mode === "agenda" ? (
            <ScheduleAgenda
              entries={visible}
              now={NOW}
              horizonDays={AGENDA_HORIZON_DAYS}
            />
          ) : range === "week" ? (
            <ScheduleWeek
              weekStart={weekStart}
              entries={visible}
              now={NOW}
              onSelect={openEntry}
            />
          ) : (
            <ScheduleMonth
              anchor={monthStart}
              entries={visible}
              now={NOW}
              onSelect={openEntry}
            />
          )}
        </div>

        <ActiveHours />
      </div>

      <EventForm
        event={eventForm.event}
        open={eventForm.open}
        defaultStart={`${anchor}T02:00:00Z`}
        onOpenChange={(open) => setEventForm((current) => ({ ...current, open }))}
        onSave={upsertEvent}
        onPropose={proposeCalendarWrite}
      />
    </div>
  )
}
