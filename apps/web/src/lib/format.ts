/**
 * Presentation-layer time formatting.
 *
 * Every timestamp crossing the API boundary is RFC 3339 UTC. This module is the *only*
 * place the owner's wall clock exists — no query, view, or migration knows about
 * Asia/Ho_Chi_Minh (docs/conventions.md §3).
 *
 * `now` is always a parameter, never `Date.now()`. A component that reads the clock
 * renders differently on the server and the client, and React tears the tree apart for it.
 */

export const OWNER_TIME_ZONE = "Asia/Ho_Chi_Minh"

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const dayShort = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "2-digit",
  month: "short",
})

const dayLong = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
})

const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: OWNER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function formatTime(iso: string): string {
  return time.format(new Date(iso))
}

export function formatDay(iso: string): string {
  return dayShort.format(new Date(iso))
}

export function formatDayLong(iso: string): string {
  return dayLong.format(new Date(iso))
}

/** Second-precision stamp. The audit log is a forensic surface; minutes are not enough. */
export function formatStamp(iso: string): string {
  return stamp.format(new Date(iso))
}

/** Calendar day in the owner's zone, `YYYY-MM-DD` — the key that groups a schedule. */
export function ownerDayKey(iso: string): string {
  return ymd.format(new Date(iso))
}

export function minutesBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 60_000,
  )
}

/**
 * Coarse relative label. Deliberately coarse: "in 3 days" is a decision input,
 * "in 2 days 19 hours" is noise on a surface read every morning.
 */
export function formatRelative(iso: string, now: string): string {
  const mins = minutesBetween(now, iso)
  const abs = Math.abs(mins)
  const suffix = (n: number, unit: string) =>
    mins < 0 ? `${n}${unit} ago` : `in ${n}${unit}`

  if (abs < 1) return "now"
  if (abs < 60) return suffix(abs, "m")
  if (abs < 60 * 24) return suffix(Math.round(abs / 60), "h")
  if (abs < 60 * 24 * 14) return suffix(Math.round(abs / (60 * 24)), "d")
  return suffix(Math.round(abs / (60 * 24 * 7)), "w")
}

export function isOverdue(dueAt: string | null, now: string): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < new Date(now).getTime()
}

/** Elapsed wall time, `H:MM`, for the session clock. */
export function formatDuration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, minutesBetween(fromIso, toIso))
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`
}

/* ------------------------------------------------------------------------------------
 * Day keys
 *
 * A day key is `YYYY-MM-DD` in the owner's zone — the calendar's unit of position.
 * Arithmetic on a key is plain date arithmetic: parse it at UTC midnight, shift, format
 * back. That is deliberate. Once a UTC instant has been resolved to an owner-local day
 * by `ownerDayKey`, the key is no longer an instant, and re-applying a timezone to it is
 * how calendars end up a day out either side of a DST boundary.
 * ---------------------------------------------------------------------------------- */

const asUtc = (dayKey: string) => new Date(`${dayKey}T00:00:00Z`)

const utcWeekday = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
})
const utcDayMonth = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
})
const utcMonthYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
})

const hourMinute = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Minutes since owner-local midnight — the vertical coordinate in a day column. */
export function ownerMinutes(iso: string): number {
  const [hour, minute] = hourMinute.format(new Date(iso)).split(":").map(Number)
  return hour * 60 + minute
}

export function addDays(dayKey: string, days: number): string {
  const date = asUtc(dayKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Monday = 0. The owner's week starts on Monday; Sunday is not a working day here. */
export function weekdayIndex(dayKey: string): number {
  return (asUtc(dayKey).getUTCDay() + 6) % 7
}

export function startOfWeek(dayKey: string): string {
  return addDays(dayKey, -weekdayIndex(dayKey))
}

export function startOfMonth(dayKey: string): string {
  return `${dayKey.slice(0, 7)}-01`
}

/** The 42 cells of a month grid: whole weeks, Monday-first, spilling either side. */
export function monthGrid(dayKey: string): string[] {
  const first = startOfWeek(startOfMonth(dayKey))
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

export function sameMonth(dayKey: string, other: string): boolean {
  return dayKey.slice(0, 7) === other.slice(0, 7)
}

export function dayOfMonth(dayKey: string): number {
  return Number(dayKey.slice(8, 10))
}

export function keyWeekday(dayKey: string): string {
  return utcWeekday.format(asUtc(dayKey))
}

export function keyDayMonth(dayKey: string): string {
  return utcDayMonth.format(asUtc(dayKey))
}

export function keyMonthYear(dayKey: string): string {
  return utcMonthYear.format(asUtc(dayKey))
}

/** `05:00`, for the hour gutter. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

/* ------------------------------------------------------------------------------------
 * Form input conversion
 *
 * `<input type="datetime-local">` speaks naive wall time with no zone attached. The
 * owner's wall clock is Asia/Ho_Chi_Minh, which is not necessarily the browser's — so
 * both directions go through the owner zone explicitly rather than through the machine's
 * locale. Getting this wrong moves every due date by the difference between two cities.
 * ---------------------------------------------------------------------------------- */

const ownerParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** UTC instant → `YYYY-MM-DDTHH:mm` in the owner's zone, for a datetime-local field. */
export function toOwnerInput(iso: string | null): string {
  if (iso === null) return ""
  const parts = Object.fromEntries(
    ownerParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** `YYYY-MM-DDTHH:mm` read as owner-local → UTC instant. */
export function fromOwnerInput(value: string): string | null {
  if (value === "") return null

  // Read the naive value as if it were UTC, then measure how far the owner zone moves
  // that instant. The difference is the offset to subtract. Works across a DST change
  // because the offset is measured at the instant in question, not assumed.
  const asIfUtc = new Date(`${value}:00Z`).getTime()
  if (Number.isNaN(asIfUtc)) return null

  const parts = Object.fromEntries(
    ownerParts.formatToParts(new Date(asIfUtc)).map((part) => [part.type, part.value]),
  )
  const shifted = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  )

  return new Date(asIfUtc - (shifted - asIfUtc)).toISOString()
}

