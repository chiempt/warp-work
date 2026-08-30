"use client"

import * as React from "react"
import {
  BanIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BlurFade } from "@/components/ui/blur-fade"
import { TextAnimate } from "@/components/ui/text-animate"
import { ContextChip } from "@/components/warp/context-chip"
import { DegradedSourceNotice } from "@/components/warp/reliability"
import { EmptyState } from "@/components/warp/states"
import { cn } from "@/lib/utils"
import { formatDayLong, formatStamp, formatTime } from "@/lib/format"
import { accountById, reports } from "@/lib/mock/data"
import type { Report } from "@/lib/mock/types"

const sections = [
  {
    key: "done" as const,
    title: "Done",
    icon: CheckCircle2Icon,
    blank: "Nothing completed in this period.",
  },
  {
    key: "waiting" as const,
    title: "Waiting on someone else",
    icon: ClockIcon,
    blank: "Nobody owes you anything right now.",
  },
  {
    key: "blocked" as const,
    title: "Blocked",
    icon: BanIcon,
    blank: "Nothing is blocked.",
  },
  {
    key: "dueNext" as const,
    title: "Due next",
    icon: CalendarClockIcon,
    blank: "Nothing falls due in the next window.",
  },
]

/**
 * The end-of-session report — the second place ADR 0006 allows Magic UI.
 *
 * It is read once, at the moment work stops, and the staged reveal is the close of the
 * session: four sections settling in the order they should be read. Nothing else in
 * Warp animates on arrival, which is exactly what makes this legible as an ending.
 *
 * The reveal runs on mount rather than on intersection: an operational surface must not
 * depend on an IntersectionObserver firing to have content in it.
 */
export function ReportView() {
  const [selectedId, setSelectedId] = React.useState(reports[0]?.id)
  const report = reports.find((r) => r.id === selectedId)

  if (!report) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No reports yet"
        description="A report is generated when a work session closes, and daily at the end of active hours. Close a session to produce the first one."
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <nav className="space-y-1" aria-label="Reports">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedId(r.id)}
            className={cn(
              "w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:bg-muted",
              r.id === selectedId && "border-border bg-muted",
            )}
          >
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {r.kind}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDayLong(r.periodEnd)}
              </span>
            </span>
            <span className="mt-1 block truncate text-sm">
              {r.done.length} done · {r.waiting.length} waiting ·{" "}
              {r.blocked.length} blocked
            </span>
          </button>
        ))}
      </nav>

      <ReportBody key={report.id} report={report} />
    </div>
  )
}

function ReportBody({ report }: { report: Report }) {
  const degraded = report.degradedAccountIds
    .map((id) => accountById.get(id))
    .filter((a) => a !== undefined)

  return (
    <article className="space-y-5">
      <header className="space-y-3 border-b border-border pb-4">
        <TextAnimate
          as="h2"
          by="word"
          animation="blurInUp"
          startOnView={false}
          duration={0.35}
          className="text-lg font-semibold tracking-tight"
        >
          {report.kind === "session"
            ? "Session report"
            : report.kind === "daily"
              ? "Daily report"
              : "Weekly report"}
        </TextAnimate>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            {formatDayLong(report.periodStart)} {formatTime(report.periodStart)} →{" "}
            {formatDayLong(report.periodEnd)} {formatTime(report.periodEnd)}
          </span>
          <span>generated {formatStamp(report.generatedAt)}</span>
          <span className="flex flex-wrap items-center gap-2">
            {report.contextIds.map((id) => (
              <ContextChip key={id} contextId={id} showParent />
            ))}
          </span>
        </div>
      </header>

      {degraded.length > 0 ? (
        <DegradedSourceNotice
          degraded={degraded}
          scope="This report was generated while a source was failing, so it"
        />
      ) : null}

      {sections.map((section, index) => {
        const items = report[section.key]
        return (
          <BlurFade key={section.key} delay={0.08 * index}>
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <section.icon
                  className={cn(
                    "size-4",
                    section.key === "blocked" && items.length > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                />
                {section.title}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {items.length}
                </span>
              </h3>
              {items.length === 0 ? (
                <p className="pl-6 text-sm text-muted-foreground">{section.blank}</p>
              ) : (
                <ul className="space-y-1.5 pl-6">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="relative text-sm before:absolute before:-left-4 before:top-2 before:size-1 before:rounded-full before:bg-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </BlurFade>
        )
      })}

      <Separator />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm">
          Copy as Markdown
        </Button>
        <p className="text-xs text-muted-foreground">
          Reports are stored as Markdown — the same text the owner reads is the text kept
          on the record.
        </p>
      </div>
    </article>
  )
}
