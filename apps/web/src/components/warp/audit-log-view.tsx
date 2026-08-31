"use client"

import * as React from "react"
import {
  BotIcon,
  ChevronRightIcon,
  ScrollTextIcon,
  ServerIcon,
  UserIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ContextChip } from "@/components/warp/context-chip"
import { EmptyState } from "@/components/warp/states"
import { cn } from "@/lib/utils"
import { useContextFilter } from "@/lib/context-filter"
import { formatRelative, formatStamp } from "@/lib/format"
import { auditEntries, NOW } from "@/lib/mock/data"
import type { AuditActor } from "@/lib/mock/types"

const ANY_ACTOR = "Any actor"

const actorIcon: Record<AuditActor, typeof UserIcon> = {
  user: UserIcon,
  agent: BotIcon,
  system: ServerIcon,
}

/**
 * The accountability record. Read after the fact, usually to answer "why did that
 * happen" — so it is a dense table with the whole diff one click away, not a feed of
 * prose. Sorted newest first and never paginated away from the moment being examined.
 */
export function AuditLogView() {
  const contextFilter = useContextFilter()
  const [actor, setActor] = React.useState(ANY_ACTOR)
  const [query, setQuery] = React.useState("")
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const rows = auditEntries
    .filter(
      (e) =>
        (actor === ANY_ACTOR || e.actor === actor) &&
        // An entry with no context — a session opening, a routing decision that
        // reached no context — belongs to every view. Hiding it behind a filter it
        // cannot satisfy would make the log look like it skipped events.
        (e.contextId === null || contextFilter.matches(e.contextId)) &&
        `${e.summary} ${e.entityType} ${e.action} ${e.entityId}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by entity, action, or text…"
          className="h-8 w-72"
        />
        <Select value={actor} onValueChange={(value) => setActor(value ?? ANY_ACTOR)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_ACTOR}>{ANY_ACTOR}</SelectItem>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="agent">agent</SelectItem>
            <SelectItem value="system">system</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {auditEntries.length} entries
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollTextIcon}
          title="No entries match"
          description="The audit log is append-only — nothing was removed. Widen the filter to see the rest."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((entry) => {
            const Icon = actorIcon[entry.actor]
            const isOpen = expanded === entry.id
            return (
              <div key={entry.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  aria-expanded={isOpen}
                >
                  <ChevronRightIcon
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className="hidden w-40 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted-foreground sm:block">
                    {formatStamp(entry.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.entityType}.{entry.action}
                      </span>
                      <ContextChip contextId={entry.contextId} />
                    </span>
                    <span className="mt-0.5 block text-sm">{entry.summary}</span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {formatRelative(entry.createdAt, NOW)}
                  </span>
                </button>

                {isOpen ? (
                  <div className="space-y-2 border-t border-border bg-muted/30 px-4 py-3 sm:pl-[15.5rem]">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-mono font-normal">
                        {entry.entityId}
                      </Badge>
                      <span>actor: {entry.actor}</span>
                      <span className="font-mono sm:hidden">
                        {formatStamp(entry.createdAt)}
                      </span>
                    </div>
                    <dl className="space-y-2">
                      {entry.diff.map((change) => (
                        <div
                          key={change.field}
                          className="grid gap-1 sm:grid-cols-[10rem_1fr]"
                        >
                          <dt className="font-mono text-xs text-muted-foreground">
                            {change.field}
                          </dt>
                          <dd className="space-y-0.5 text-sm">
                            <p className="text-muted-foreground line-through decoration-destructive/60">
                              {change.before ?? "∅"}
                            </p>
                            <p>{change.after ?? "∅"}</p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
