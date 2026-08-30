import { cn } from "@/lib/utils"
import { contextById } from "@/lib/mock/data"
import type { ContextKind } from "@/lib/mock/types"

const kindDot: Record<ContextKind, string> = {
  work: "bg-context-work",
  study: "bg-context-study",
  personal: "bg-context-personal",
}

/**
 * The context accent, for surfaces that colour a whole block rather than a dot — the
 * calendar grid. Kept here so there is exactly one mapping from `contexts.kind` to a
 * colour in the interface.
 */
const kindTone: Record<ContextKind, { block: string; edge: string; text: string }> = {
  work: {
    block: "bg-context-work/15",
    edge: "border-l-context-work",
    text: "text-context-work",
  },
  study: {
    block: "bg-context-study/15",
    edge: "border-l-context-study",
    text: "text-context-study",
  },
  personal: {
    block: "bg-context-personal/15",
    edge: "border-l-context-personal",
    text: "text-context-personal",
  },
}

export function contextTone(contextId: string | null) {
  const kind = contextId ? contextById.get(contextId)?.kind : undefined
  return kind
    ? kindTone[kind]
    : { block: "bg-muted", edge: "border-l-border", text: "text-muted-foreground" }
}

export function contextDot(contextId: string | null) {
  const kind = contextId ? contextById.get(contextId)?.kind : undefined
  return kind ? kindDot[kind] : "bg-muted-foreground"
}

/**
 * The context marker. Every derived record carries one, so this is the single most
 * repeated element in the interface — a dot and a word, never a filled pill. Contexts
 * are the axis, not an alert.
 */
export function ContextChip({
  contextId,
  className,
  showParent = false,
}: {
  contextId: string | null
  className?: string
  showParent?: boolean
}) {
  const context = contextId ? contextById.get(contextId) : undefined

  if (!context) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <span className="size-1.5 rounded-full border border-dashed border-muted-foreground/70" />
        Unrouted
      </span>
    )
  }

  const parent = context.parentId ? contextById.get(context.parentId) : undefined

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", kindDot[context.kind])} />
      {showParent && parent ? `${parent.name} › ${context.name}` : context.name}
    </span>
  )
}

export function ContextRail({ contextId }: { contextId: string | null }) {
  const context = contextId ? contextById.get(contextId) : undefined
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-y-0 left-0 w-0.5",
        context ? kindDot[context.kind] : "bg-border",
      )}
    />
  )
}
