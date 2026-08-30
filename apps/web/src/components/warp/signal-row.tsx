import {
  CalendarIcon,
  FileIcon,
  MailIcon,
  MessageSquareIcon,
  StickyNoteIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ContextChip } from "@/components/warp/context-chip"
import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/format"
import { accountById } from "@/lib/mock/data"
import type { Signal } from "@/lib/mock/types"

const icons = {
  email: MailIcon,
  message: MessageSquareIcon,
  calendar_event: CalendarIcon,
  file: FileIcon,
  note: StickyNoteIcon,
} as const

/** TODO(open-question-1): working default — auto-assign at or above 0.8, queue below. */
const ROUTING_CONFIDENCE_FLOOR = 0.8

export function SignalRow({ signal }: { signal: Signal }) {
  const Icon = icons[signal.kind]
  const account = accountById.get(signal.accountId)
  const needsRouting =
    signal.contextId === null ||
    (signal.confidence !== null && signal.confidence < ROUTING_CONFIDENCE_FLOOR)

  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{signal.from}</span>
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(signal.occurredAt)}
          </span>
        </div>
        <p className="truncate text-sm">{signal.subject}</p>
        <p className="truncate text-xs text-muted-foreground">{signal.preview}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <ContextChip contextId={signal.contextId} />
          {signal.assignedBy ? (
            <Badge
              variant="ghost"
              className={cn(
                "font-normal text-muted-foreground",
                needsRouting && "text-reliability-unofficial",
              )}
            >
              {signal.assignedBy}
              {signal.confidence !== null && signal.assignedBy === "model"
                ? ` · ${signal.confidence.toFixed(2)}`
                : null}
            </Badge>
          ) : null}
          {needsRouting ? (
            <Badge variant="outline" className="font-normal">
              needs routing
            </Badge>
          ) : null}
          <span className="truncate text-xs text-muted-foreground">
            {account?.displayName}
          </span>
        </div>
      </div>
    </div>
  )
}
