import type { LucideIcon } from "lucide-react"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { BlurFade } from "@/components/ui/blur-fade"
import { cn } from "@/lib/utils"

/**
 * Every list ships all three of these (docs/conventions.md §7).
 *
 * An empty state is the one place Magic UI earns a place on an operational surface: it
 * is the only moment where nothing is being read, so a short fade costs no attention and
 * tells the owner the list rendered rather than failed.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <BlurFade delay={0.05} className={cn("w-full", className)}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {action ? <EmptyContent>{action}</EmptyContent> : null}
      </Empty>
    </BlurFade>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-3"
        >
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${70 - i * 8}%` }} />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({
  title = "This list could not be loaded",
  detail,
  onRetry,
}: {
  title?: string
  detail: string
  onRetry?: () => void
}) {
  return (
    <Empty className="border border-dashed border-destructive/40">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCwIcon /> Retry
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
