/**
 * The schedule's one source of entries, shared by both modes.
 *
 * Three tables land on the same clock and they are not the same thing, so the kind
 * travels with every entry. An `event` came from a calendar someone else can also see; a
 * `task` or `commitment` is a date Warp *derived* from a signal, and the interface has to
 * keep saying so — a deadline that looks like a meeting is a deadline that gets treated
 * like one.
 */

import { minutesBetween, ownerDayKey } from "@/lib/format"
import {
  commitments as seedCommitments,
  events as seedEvents,
  personById,
  tasks as seedTasks,
} from "@/lib/mock/data"
import type { Commitment, Task, WorkEvent } from "@/lib/mock/types"

export type ScheduleKind = "event" | "task" | "commitment"

export interface ScheduleEntry {
  id: string
  kind: ScheduleKind
  title: string
  contextId: string
  startAt: string
  /** Null for a point in time: a due date, or an event with no stated end. */
  endAt: string | null
  meta: string | null
  tentative: boolean
}

/** Minutes a point-in-time entry occupies in a day column, so it stays clickable. */
export const POINT_ENTRY_MINUTES = 30

export function scheduleEntries({
  events = seedEvents,
  tasks = seedTasks,
  commitments = seedCommitments,
}: {
  events?: WorkEvent[]
  tasks?: Task[]
  commitments?: Commitment[]
} = {}): ScheduleEntry[] {
  const fromEvents: ScheduleEntry[] = events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: event.id,
      kind: "event",
      title: event.title,
      contextId: event.contextId,
      startAt: event.startAt,
      endAt: event.endAt,
      meta:
        [
          event.location,
          event.personId ? personById.get(event.personId)?.displayName : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      tentative: event.status === "tentative",
    }))

  const fromTasks: ScheduleEntry[] = tasks
    .filter(
      (task) =>
        task.dueAt !== null && task.status !== "done" && task.status !== "dropped",
    )
    .map((task) => ({
      id: task.id,
      kind: "task",
      title: task.title,
      contextId: task.contextId,
      startAt: task.dueAt as string,
      endAt: null,
      meta: task.estimatedMinutes ? `${task.estimatedMinutes} min of work` : null,
      tentative: false,
    }))

  const fromCommitments: ScheduleEntry[] = commitments
    .filter((commitment) => commitment.status === "open" && commitment.dueAt !== null)
    .map((commitment) => ({
      id: commitment.id,
      kind: "commitment",
      title: commitment.what,
      contextId: commitment.contextId,
      startAt: commitment.dueAt as string,
      endAt: null,
      meta:
        (commitment.direction === "i_owe" ? "owed to " : "owed by ") +
        (personById.get(commitment.personId)?.displayName ?? "someone"),
      tentative: false,
    }))

  return [...fromEvents, ...fromTasks, ...fromCommitments].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  )
}

export function durationMinutes(entry: ScheduleEntry): number {
  return entry.endAt
    ? Math.max(POINT_ENTRY_MINUTES, minutesBetween(entry.startAt, entry.endAt))
    : POINT_ENTRY_MINUTES
}

/** Entries grouped by the owner-local day they start on. */
export function byDay(entries: ScheduleEntry[]): Map<string, ScheduleEntry[]> {
  const days = new Map<string, ScheduleEntry[]>()
  for (const entry of entries) {
    const key = ownerDayKey(entry.startAt)
    days.set(key, [...(days.get(key) ?? []), entry])
  }
  return days
}

/**
 * Lane assignment for overlapping entries in one day column, the way a calendar does it:
 * break the day into clusters that actually touch, then give each cluster only as many
 * lanes as it needs. Done globally per day, one late meeting would halve the width of
 * everything above it.
 */
export function assignLanes(
  entries: ScheduleEntry[],
): Array<{ entry: ScheduleEntry; lane: number; lanes: number }> {
  const sorted = [...entries].sort((a, b) => a.startAt.localeCompare(b.startAt))
  const out: Array<{ entry: ScheduleEntry; lane: number; lanes: number }> = []

  let cluster: Array<{ entry: ScheduleEntry; lane: number; start: number; end: number }> = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const item of cluster) {
      out.push({ entry: item.entry, lane: item.lane, lanes: laneEnds.length })
    }
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }

  for (const entry of sorted) {
    const start = new Date(entry.startAt).getTime()
    const end = start + durationMinutes(entry) * 60_000

    if (cluster.length > 0 && start >= clusterEnd) {
      flush()
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }

    cluster.push({ entry, lane, start, end })
    clusterEnd = Math.max(clusterEnd, end)
  }

  flush()
  return out
}
