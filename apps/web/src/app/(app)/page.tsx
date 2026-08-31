import Link from "next/link"
import { ArrowRightIcon, CalendarClockIcon, InboxIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CommitmentRow } from "@/components/warp/commitment-row"
import { ContextChip } from "@/components/warp/context-chip"
import { PageHeader } from "@/components/warp/page-header"
import { DegradedSourceNotice } from "@/components/warp/reliability"
import { ReviewQueue } from "@/components/warp/review-queue"
import { SignalFeed } from "@/components/warp/signal-feed"
import { StatCard } from "@/components/warp/stat-card"
import { EmptyState } from "@/components/warp/states"
import { contextMatcher, parseContextParam } from "@/lib/context-scope"
import { formatRelative, formatTime, isOverdue, ownerDayKey } from "@/lib/format"
import {
  commitments,
  events,
  NOW,
  openSession,
  proposedActions,
  signals,
  tasks,
} from "@/lib/mock/data"

export default async function DashboardPage(props: PageProps<"/">) {
  // The sidebar's context selection, applied here too. Read from the URL rather than
  // from a client hook so the server renders the filtered page directly — the summary
  // never briefly shows contexts the owner has filtered out.
  const params = await props.searchParams
  const inContext = contextMatcher(parseContextParam(params.contexts))

  const pending = proposedActions.filter(
    (a) => a.status === "pending" && inContext(a.contextId),
  )
  const openCommitments = commitments
    .filter((c) => c.status === "open")
    .filter((c) => inContext(c.contextId))
  const iOwe = openCommitments.filter((c) => c.direction === "i_owe")
  const overdue = openCommitments.filter((c) => isOverdue(c.dueAt, NOW))
  const today = ownerDayKey(NOW)

  const dueToday = tasks.filter(
    (t) =>
      inContext(t.contextId) &&
      t.status !== "done" &&
      t.status !== "dropped" &&
      t.dueAt !== null &&
      ownerDayKey(t.dueAt) === today,
  )

  const todaysEvents = events
    .filter(
      (e) =>
        inContext(e.contextId) &&
        ownerDayKey(e.startAt) === today &&
        e.status !== "cancelled",
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  const atRisk = [...openCommitments]
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What is owed, what is waiting on you, and what the agents drafted this session."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            {openSession.contextIds.map((id) => (
              <ContextChip key={id} contextId={id} />
            ))}
          </div>
        }
      />

      <DegradedSourceNotice scope="Today's picture" />

      {/* Ordered by how soon it bites, left to right: what is already late, what needs a
          decision now, what lands today, then the standing total. An earlier order led
          with the total, which is the one number that does not change what you do next. */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "urgent" : "default"}
          caption="Past their due date and still open."
        />
        <StatCard
          label="Awaiting review"
          value={pending.length}
          caption="Drafted this session. Nothing has been sent."
        />
        <StatCard
          label="Due today"
          value={dueToday.length}
          caption="Tasks with a due date inside today, Asia/Ho_Chi_Minh."
        />
        <StatCard
          label="I owe"
          value={iOwe.length}
          caption="Open promises made by you, across every context."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Review queue</h2>
                <p className="text-xs text-muted-foreground">
                  Agents drafted these inside the open session. You approve, edit, or
                  reject — nothing leaves Warp on its own.
                </p>
              </div>
            </div>
            <ReviewQueue actions={pending} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Today</CardTitle>
              <CardDescription>
                {todaysEvents.length} event{todaysEvents.length === 1 ? "" : "s"} ·{" "}
                {dueToday.length} task{dueToday.length === 1 ? "" : "s"} due
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/schedule" />}
                >
                  Schedule <ArrowRightIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {todaysEvents.length === 0 ? (
                <EmptyState
                  icon={CalendarClockIcon}
                  title="Nothing scheduled today"
                  description="No events landed from a connected calendar for today in Asia/Ho_Chi_Minh."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {todaysEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatTime(event.startAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <div className="flex items-center gap-2">
                          <ContextChip contextId={event.contextId} />
                          {event.location ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(event.startAt, NOW)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Commitments at risk</CardTitle>
              <CardDescription>
                The record nothing else keeps. Sorted by how soon they bite.
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/work-items?tab=commitments" />}
                >
                  All <ArrowRightIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {atRisk.map((commitment) => (
                  <CommitmentRow key={commitment.id} commitment={commitment} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Incoming signals</CardTitle>
              <CardDescription>
                Raw and immutable, as they arrived. Routing shown with its source and
                confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signals.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="No signals yet"
                  description="Connect an account, or forward mail to the manual address, and the timeline fills itself."
                />
              ) : (
                <SignalFeed
                  signals={signals
                    .filter((s) => s.contextId === null || inContext(s.contextId))
                    .slice(0, 5)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Session</CardTitle>
              <CardDescription>
                Opened {formatTime(openSession.startedAt)} · scoped to{" "}
                {openSession.contextIds.length} contexts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Actions proposed" value={openSession.actionsProposed} />
              <Row label="Actions approved" value={openSession.actionsApproved} />
              <Separator />
              <Row
                label="Tokens in / out"
                value={`${openSession.tokensIn.toLocaleString()} / ${openSession.tokensOut.toLocaleString()}`}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </div>
  )
}
