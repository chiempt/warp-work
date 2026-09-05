import { cn } from "@/lib/utils"
import { contextById } from "@/lib/mock/data"
import type { ContextColor } from "@/lib/mock/types"

const colorDot: Record<ContextColor, string> = {
  slate: "bg-context-slate",
  blue: "bg-context-blue",
  violet: "bg-context-violet",
  green: "bg-context-green",
  teal: "bg-context-teal",
  rose: "bg-context-rose",
}

/**
 * The context accent, for surfaces that colour a whole block rather than a dot — the
 * calendar grid. Kept here so there is exactly one mapping from `contexts.color` to a
 * class in the interface.
 */
const colorTone: Record<ContextColor, { block: string; edge: string; text: string }> = {
  slate: {
    block: "bg-context-slate/15",
    edge: "border-l-context-slate",
    text: "text-context-slate",
  },
  blue: {
    block: "bg-context-blue/15",
    edge: "border-l-context-blue",
    text: "text-context-blue",
  },
  violet: {
    block: "bg-context-violet/15",
    edge: "border-l-context-violet",
    text: "text-context-violet",
  },
  green: {
    block: "bg-context-green/15",
    edge: "border-l-context-green",
    text: "text-context-green",
  },
  teal: {
    block: "bg-context-teal/15",
    edge: "border-l-context-teal",
    text: "text-context-teal",
  },
  rose: {
    block: "bg-context-rose/15",
    edge: "border-l-context-rose",
    text: "text-context-rose",
  },
}

/**
 * A context is allowed to have no colour, so every lookup goes through here rather
 * than indexing the record directly — an uncoloured context renders in the neutral
 * tone instead of resolving to a class name that does not exist.
 */
export function dotClass(color: ContextColor | null | undefined) {
  return color ? colorDot[color] : "bg-muted-foreground"
}

export function contextTone(contextId: string | null) {
  const color = contextId ? contextById.get(contextId)?.color : undefined
  return color
    ? colorTone[color]
    : { block: "bg-muted", edge: "border-l-border", text: "text-muted-foreground" }
}

export function contextDot(contextId: string | null) {
  return dotClass(contextId ? contextById.get(contextId)?.color : undefined)
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
  preview,
}: {
  contextId: string | null
  className?: string
  showParent?: boolean
  /**
   * The context itself, when the caller already has it.
   *
   * Lookup by id goes through the fixtures, which a context created during this
   * session is not in — it would render as "Unrouted", which is what the record
   * means, not what it is. Callers holding the live list pass the object instead.
   */
  preview?: { name: string; color: ContextColor | null }
}) {
  if (preview) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground",
          className,
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", dotClass(preview.color))} />
        {preview.name}
      </span>
    )
  }

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
      <span className={cn("size-1.5 shrink-0 rounded-full", dotClass(context.color))} />
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
        context ? dotClass(context.color) : "bg-border",
      )}
    />
  )
}
