import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ContextChip } from "@/components/warp/context-chip"
import {
  CommitmentStatusBadge,
  DirectionBadge,
} from "@/components/warp/status-badge"
import { cn } from "@/lib/utils"
import { formatDay, formatRelative, isOverdue } from "@/lib/format"
import { NOW, personById, signalById } from "@/lib/mock/data"
import type { Commitment } from "@/lib/mock/types"

/**
 * A promise, with the signal that proves it one hover away. A commitment the owner
 * cannot trace back to its evidence is a commitment they will not act on.
 */
export function CommitmentRow({
  commitment,
  showStatus = false,
}: {
  commitment: Commitment
  showStatus?: boolean
}) {
  const person = personById.get(commitment.personId)
  const evidence = signalById.get(commitment.evidenceSignalId)
  const late = commitment.status === "open" && isOverdue(commitment.dueAt, NOW)

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <DirectionBadge direction={commitment.direction} />
          <span className="truncate text-sm font-medium">{commitment.what}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {commitment.direction === "i_owe" ? "to" : "from"}{" "}
            <span className="text-foreground">{person?.displayName}</span>
          </span>
          <ContextChip contextId={commitment.contextId} />
          {evidence ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                    evidence
                  </span>
                }
              />
              <TooltipContent className="max-w-72">
                <p className="font-medium">{evidence.subject}</p>
                <p className="text-muted-foreground">
                  {evidence.from} · {formatDay(evidence.occurredAt)}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : null}
          {showStatus ? <CommitmentStatusBadge status={commitment.status} /> : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            late ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {commitment.dueAt ? formatRelative(commitment.dueAt, NOW) : "no date"}
        </p>
        <p className="text-xs text-muted-foreground">
          {commitment.dueAt ? formatDay(commitment.dueAt) : "—"}
        </p>
      </div>
    </div>
  )
}
