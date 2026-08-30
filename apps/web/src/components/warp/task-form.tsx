"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { contexts, contextById } from "@/lib/mock/data"
import { fromOwnerInput, OWNER_TIME_ZONE, toOwnerInput } from "@/lib/format"
import type { Task, TaskOwner, TaskStatus } from "@/lib/mock/types"

const STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done", "dropped"]
const OWNERS: TaskOwner[] = ["me", "agent"]
const PRIORITIES = [1, 2, 3, 4, 5]

const label = (value: string) => value.replace(/_/g, " ")

const blank = (): Task => ({
  id: "",
  contextId: contexts[0].id,
  title: "",
  detail: "",
  status: "open",
  owner: "me",
  priority: 3,
  dueAt: null,
  estimatedMinutes: null,
  sourceSignalId: null,
  blockedReason: null,
})

/**
 * Create or edit a task.
 *
 * Most tasks are derived — extraction reads a signal and writes them. This is the other
 * path, and it is a real one: `tasks.source_signal_id` is nullable, and every context has
 * to stay usable on manual sources alone (context doc §4). What a hand-written task must
 * never do is pretend to be derived, so it is saved with no source signal and the detail
 * sheet says as much.
 *
 * The form enforces the same rules the schema does — `tasks_priority_range`,
 * `tasks_estimate_positive`, `tasks_blocked_has_reason` — so the UI cannot assemble a row
 * Postgres would refuse.
 */
export function TaskForm({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  /** Null creates; a task edits it. */
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (task: Task) => void
}) {
  const isEdit = task !== null
  const [draft, setDraft] = React.useState<Task>(task ?? blank())

  // Re-seed whenever the sheet opens on a different record.
  const seed = task?.id ?? "new"
  const [seededFor, setSeededFor] = React.useState(seed)
  if (seededFor !== seed) {
    setSeededFor(seed)
    setDraft(task ?? blank())
  }

  const set = <K extends keyof Task>(key: K, value: Task[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const needsReason = draft.status === "blocked"
  const reasonMissing = needsReason && (draft.blockedReason ?? "").trim() === ""
  const valid = draft.title.trim() !== "" && !reasonMissing

  const save = () => {
    if (!valid) return
    onSave({
      ...draft,
      title: draft.title.trim(),
      blockedReason: needsReason ? draft.blockedReason : null,
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit task" : "New task"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Changes apply to this task only. The signal it came from is never modified."
              : "Recorded by hand, with no source signal. Re-running extraction will not touch it."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What has to be done"
              aria-invalid={draft.title.trim() === ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-detail">Detail</Label>
            <Textarea
              id="task-detail"
              rows={3}
              value={draft.detail}
              onChange={(e) => set("detail", e.target.value)}
              placeholder="Anything the title cannot carry"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Context</Label>
              <Select
                value={draft.contextId}
                onValueChange={(value) => set("contextId", value ?? draft.contextId)}
              >
                <SelectTrigger className="w-full">
                  {/* The value is a context id; the trigger has to show its name. */}
                  <SelectValue>
                    {(value) => contextById.get(String(value))?.name ?? "Choose"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contexts.map((context) => (
                    <SelectItem key={context.id} value={context.id}>
                      {context.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  set("status", (value as TaskStatus) ?? draft.status)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(value) => label(String(value))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {label(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select
                value={draft.owner}
                onValueChange={(value) =>
                  set("owner", (value as TaskOwner) ?? draft.owner)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERS.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={String(draft.priority)}
                onValueChange={(value) => set("priority", Number(value ?? 3))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{(value) => `P${value}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={String(priority)}>
                      P{priority}
                      {priority === 1 ? " — highest" : priority === 5 ? " — lowest" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="task-blocked">Blocked because</Label>
              <Input
                id="task-blocked"
                value={draft.blockedReason ?? ""}
                onChange={(e) => set("blockedReason", e.target.value)}
                placeholder="What is in the way"
                aria-invalid={reasonMissing}
              />
              <p className="text-xs text-muted-foreground">
                Required. A blocked task without a reason is a task nobody can unblock —
                the database refuses one too.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={toOwnerInput(draft.dueAt)}
                onChange={(e) => set("dueAt", fromOwnerInput(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{OWNER_TIME_ZONE}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-estimate">Estimate (minutes)</Label>
              <Input
                id="task-estimate"
                type="number"
                min={1}
                value={draft.estimatedMinutes ?? ""}
                onChange={(e) =>
                  set(
                    "estimatedMinutes",
                    e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                  )
                }
                placeholder="—"
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
