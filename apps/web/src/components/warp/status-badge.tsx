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
 * read differently at a glance rather than sharing a neutral chip.
 */
export function DirectionBadge({
  direction,
}: {
  direction: CommitmentDirection
}) {
  return direction === "i_owe" ? (
    <Badge variant="destructive" className="font-normal">
      I owe
    </Badge>
  ) : (
    <Badge variant="outline" className="font-normal">
      Owed to me
    </Badge>
  )
}

export function RiskBadge({ risk }: { risk: ActionRisk }) {
  const variant: Record<ActionRisk, Variant> = {
    low: "ghost",
    medium: "outline",
    high: "destructive",
  }
  return <Chip variant={variant[risk]}>{risk} risk</Chip>
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
