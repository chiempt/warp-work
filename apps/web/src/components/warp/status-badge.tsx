import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  ActionRisk,
  AutonomyLevel,
  CommitmentDirection,
  CommitmentStatus,
  ProposedActionStatus,
  RunStatus,
  TaskStatus,
} from "@/lib/mock/types"

type Variant = React.ComponentProps<typeof Badge>["variant"]

/** Words come from the enums verbatim; only the spacing is cosmetic. */
const label = (value: string) => value.replace(/_/g, " ")

function Chip({
  children,
  variant = "outline",
  className,
}: {
  children: React.ReactNode
  variant?: Variant
  className?: string
}) {
  return (
    <Badge variant={variant} className={cn("font-normal capitalize", className)}>
      {children}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variant: Record<TaskStatus, Variant> = {
    open: "outline",
    in_progress: "secondary",
    blocked: "destructive",
    done: "outline",
    dropped: "ghost",
  }
  return (
    <Chip
      variant={variant[status]}
      className={cn(status === "done" && "text-muted-foreground line-through")}
    >
      {label(status)}
    </Chip>
  )
}

export function CommitmentStatusBadge({ status }: { status: CommitmentStatus }) {
  const variant: Record<CommitmentStatus, Variant> = {
    open: "outline",
    fulfilled: "secondary",
    waived: "ghost",
    dropped: "ghost",
  }
  return <Chip variant={variant[status]}>{label(status)}</Chip>
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const variant: Record<RunStatus, Variant> = {
    queued: "outline",
    running: "secondary",
    succeeded: "outline",
    failed: "destructive",
    cancelled: "ghost",
  }
  return (
    <Chip variant={variant[status]}>
      {status === "running" ? (
        <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {label(status)}
    </Chip>
  )
}

export function ProposedActionStatusBadge({
  status,
}: {
  status: ProposedActionStatus
}) {
  const variant: Record<ProposedActionStatus, Variant> = {
    pending: "outline",
    approved: "secondary",
    edited: "secondary",
    rejected: "ghost",
    expired: "ghost",
  }
  return <Chip variant={variant[status]}>{label(status)}</Chip>
}

/**
 * Direction is the whole point of a commitment. Two values, no third case — so the two
 * read differently at a glance.
 *
 * Not in red. `i_owe` is a category, and roughly half of all commitments carry it;
 * painting half the board like an alarm is how a reader stops seeing the alarms. The
 * weight difference carries it — solid for what you owe, outlined for what is owed to
 * you — and red stays for the one thing that is actually wrong: overdue.
 */
export function DirectionBadge({
  direction,
}: {
  direction: CommitmentDirection
}) {
  return direction === "i_owe" ? (
    <Badge variant="secondary" className="font-medium">
      I owe
    </Badge>
  ) : (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Owed to me
    </Badge>
  )
}

/**
 * A scale, so the three steps have to be separable at a glance. Low and medium were both
 * outlined chips and read as the same thing, which made the scale decorative.
 */
export function RiskBadge({ risk }: { risk: ActionRisk }) {
  if (risk === "high") {
    return <Chip variant="destructive">high risk</Chip>
  }
  if (risk === "medium") {
    return (
      <Chip variant="outline" className="border-warning/50 font-normal text-warning">
        medium risk
      </Chip>
    )
  }
  return (
    <Chip variant="ghost" className="text-muted-foreground">
      low risk
    </Chip>
  )
}

export function AutonomyBadge({ level }: { level: AutonomyLevel }) {
  if (level === "auto") {
    // Phase 4. The enum carries the value; nothing in the interface offers it yet.
    return (
      <Chip variant="ghost" className="text-muted-foreground">
        auto — locked
      </Chip>
    )
  }
  return <Chip variant={level === "ask" ? "outline" : "secondary"}>{level}</Chip>
}

export function PriorityMark({ priority }: { priority: number }) {
  return (
    <span
      className="font-mono text-xs tabular-nums text-muted-foreground"
      title={`Priority ${priority} of 5`}
    >
      P{priority}
    </span>
  )
}
