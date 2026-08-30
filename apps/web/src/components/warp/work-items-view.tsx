"use client"

import * as React from "react"
import { CircleCheckIcon, HandshakeIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { CommitmentRow } from "@/components/warp/commitment-row"
import { ContextChip } from "@/components/warp/context-chip"
import {
  CommitmentStatusBadge,
  PriorityMark,
  TaskStatusBadge,
} from "@/components/warp/status-badge"
import { EmptyState } from "@/components/warp/states"
import { cn } from "@/lib/utils"
import { formatDay, formatRelative, isOverdue } from "@/lib/format"
import {
  commitments as allCommitments,
  contexts,
  contextById,
  NOW,
  personById,
  signalById,
  tasks as allTasks,
} from "@/lib/mock/data"
import type { Task } from "@/lib/mock/types"

const ANY = "All contexts"
const OPEN_ONLY = "Open only"

/**
 * Tasks and commitments are both *derived* from signals, so they share one screen and
 * one filter bar. Events are derived too, but they are read against a clock rather than
 * a list, which is why they live on Schedule instead.
 */
export function WorkItemsView({
  initialTab = "tasks",
  initialContextSlug,
}: {
  initialTab?: string
  initialContextSlug?: string
}) {
  const initialContext =
    contexts.find((c) => c.slug === initialContextSlug)?.name ?? ANY

  const [contextName, setContextName] = React.useState(initialContext)
  const [statusFilter, setStatusFilter] = React.useState(OPEN_ONLY)
  const [query, setQuery] = React.useState("")
  const [openTask, setOpenTask] = React.useState<Task | null>(null)

  const contextId =
    contextName === ANY
      ? null
      : (contexts.find((c) => c.name === contextName)?.id ?? null)

  const matches = (id: string, text: string) =>
    (contextId === null || id === contextId) &&
    text.toLowerCase().includes(query.toLowerCase())

  const tasks = allTasks.filter(
    (t) =>
      matches(t.contextId, `${t.title} ${t.detail}`) &&
      (statusFilter === OPEN_ONLY
        ? t.status !== "done" && t.status !== "dropped"
        : true),
  )

  const commitments = allCommitments.filter(
    (c) =>
      matches(c.contextId, c.what) &&
      (statusFilter === OPEN_ONLY ? c.status === "open" : true),
  )

  return (
    <Tabs defaultValue={initialTab} className="gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="commitments">Commitments</TabsTrigger>
        </TabsList>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-8 w-44 pl-7"
            />
          </div>

          <Select value={contextName} onValueChange={(value) => setContextName(value ?? ANY)}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{ANY}</SelectItem>
              {contexts.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? OPEN_ONLY)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OPEN_ONLY}>{OPEN_ONLY}</SelectItem>
              <SelectItem value="Everything">Everything</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <TabsContent value="tasks">
        {tasks.length === 0 ? (
          <EmptyState
            icon={CircleCheckIcon}
            title="No tasks match"
            description="Tasks are derived from signals — they are not typed in. If a signal should have produced one, re-run extraction over it rather than adding it by hand."
            action={
              <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear filter
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Task</TableHead>
                  <TableHead className="w-40">Context</TableHead>
                  <TableHead className="w-24">Owner</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32 text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const late = isOverdue(task.dueAt, NOW) && task.status !== "done"
                  return (
                    <TableRow
                      key={task.id}
                      onClick={() => setOpenTask(task)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-center">
                        <PriorityMark priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{task.title}</p>
                        {task.blockedReason ? (
                          <p className="text-xs text-destructive">
                            {task.blockedReason}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <ContextChip contextId={task.contextId} showParent />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {task.owner === "agent" ? "agent" : "me"}
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs tabular-nums",
                          late ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {task.dueAt ? formatRelative(task.dueAt, NOW) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="commitments">
        {commitments.length === 0 ? (
          <EmptyState
            icon={HandshakeIcon}
            title="No commitments match"
            description="A commitment is only recorded when a signal proves it was promised. Nothing here means nothing was found — not that nothing was promised."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(["i_owe", "owed_to_me"] as const).map((direction) => {
              const column = commitments.filter((c) => c.direction === direction)
              return (
                <section
                  key={direction}
                  className="rounded-xl border border-border bg-card"
                >
                  <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold">
                      {direction === "i_owe" ? "I owe" : "Owed to me"}
                    </h3>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {column.length}
                    </span>
                  </header>
                  <div className="divide-y divide-border px-4">
                    {column.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Nothing outstanding.
                      </p>
                    ) : (
                      column.map((c) => (
                        <CommitmentRow key={c.id} commitment={c} showStatus />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </TabsContent>

      <TaskSheet task={openTask} onClose={() => setOpenTask(null)} />
    </Tabs>
  )
}

function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const context = task ? contextById.get(task.contextId) : undefined
  const signal = task?.sourceSignalId ? signalById.get(task.sourceSignalId) : undefined
  const related = task
    ? allCommitments.filter((c) => c.evidenceSignalId === task.sourceSignalId)
    : []

  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        {task ? (
          <>
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>
                {task.detail || "No detail was extracted for this task."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-4 text-sm">
              <dl className="grid grid-cols-2 gap-y-3">
                <Field label="Context">
                  <ContextChip contextId={task.contextId} showParent />
                </Field>
                <Field label="Status">
                  <TaskStatusBadge status={task.status} />
                </Field>
                <Field label="Owner">{task.owner}</Field>
                <Field label="Priority">P{task.priority} of 5</Field>
                <Field label="Due">
                  {task.dueAt ? formatDay(task.dueAt) : "no date"}
                </Field>
                <Field label="Estimate">
                  {task.estimatedMinutes ? `${task.estimatedMinutes} min` : "—"}
                </Field>
              </dl>

              <Separator />

              <section className="space-y-1.5">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Derived from
                </h4>
                {signal ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{signal.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {signal.from} · {formatDay(signal.occurredAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {signal.preview}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Entered manually — no source signal.
                  </p>
                )}
              </section>

              {related.length > 0 ? (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Commitments on the same evidence
                  </h4>
                  <ul className="space-y-2">
                    {related.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <CommitmentStatusBadge status={c.status} />
                        <span className="truncate">{c.what}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {personById.get(c.personId)?.displayName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {context ? (
                <p className="text-xs text-muted-foreground">
                  Anything drafted for this task uses the {context.name} tone profile:{" "}
                  {context.toneProfile}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center text-sm">{children}</dd>
    </div>
  )
}
