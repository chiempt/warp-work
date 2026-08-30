"use client"

import * as React from "react"
import { CalendarSyncIcon, TriangleAlertIcon } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { fromOwnerInput, OWNER_TIME_ZONE, toOwnerInput } from "@/lib/format"
import { contexts, contextById, people, personById } from "@/lib/mock/data"
import type { EventStatus, WorkEvent } from "@/lib/mock/types"

const STATUSES: EventStatus[] = ["confirmed", "tentative", "cancelled"]
const NOBODY = "__nobody__"

const blank = (startAt: string): WorkEvent => ({
  id: "",
  contextId: contexts[0].id,
  title: "",
  startAt,
  endAt: new Date(new Date(startAt).getTime() + 60 * 60_000).toISOString(),
  location: null,
  status: "confirmed",
  personId: null,
  sourceSignalId: null,
  externalCalendarId: null,
})

/**
 * Create or edit an event — and the one place in the app where a form has to decide
 * whether it is writing locally or reaching outside.
 *
 * An event with no `external_calendar_id` lives only in Warp: saving it is a local write
 * and nothing leaves. An event that came from Google is on a calendar other people can
 * see, so changing it changes something outside the system — which is exactly what
 * `proposed_actions` exists for. This form does not send that change; it queues it for
 * review, the same as a drafted email. There is no quick-send path here and there is not
 * going to be one.
 */
export function EventForm({
  event,
  open,
  defaultStart,
  onOpenChange,
  onSave,
  onPropose,
}: {
  /** Null creates; an event edits it. */
  event: WorkEvent | null
  open: boolean
  defaultStart: string
  onOpenChange: (open: boolean) => void
  onSave: (event: WorkEvent) => void
  /** Queue an outbound calendar write for the review queue. */
  onPropose: (event: WorkEvent, kind: "create" | "update") => void
}) {
  const isEdit = event !== null
  const [draft, setDraft] = React.useState<WorkEvent>(event ?? blank(defaultStart))
  const [alsoGoogle, setAlsoGoogle] = React.useState(false)

  const seed = event?.id ?? `new-${defaultStart}`
  const [seededFor, setSeededFor] = React.useState(seed)
  if (seededFor !== seed) {
    setSeededFor(seed)
    setDraft(event ?? blank(defaultStart))
    setAlsoGoogle(false)
  }

  const set = <K extends keyof WorkEvent>(key: K, value: WorkEvent[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const external = draft.externalCalendarId !== null
  const badOrder =
    draft.endAt !== null && new Date(draft.endAt) < new Date(draft.startAt)
  const valid = draft.title.trim() !== "" && !badOrder

  const save = () => {
    if (!valid) return
    const next = { ...draft, title: draft.title.trim() }
    if (external) {
      // The record is somebody else's too. Queue it; do not write it.
      onPropose(next, "update")
    } else {
      onSave(next)
      if (alsoGoogle) onPropose(next, "create")
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit event" : "New event"}</SheetTitle>
          <SheetDescription>
            {external
              ? "This event lives on a connected Google calendar."
              : "Kept in Warp. Nothing is written to a calendar unless you ask for it below."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {external ? (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                Saving does not change Google. Other people can see this calendar, so the
                edit is queued as a proposed action and sent only when you approve it in
                the review queue.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What is happening"
              aria-invalid={draft.title.trim() === ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={toOwnerInput(draft.startAt)}
                onChange={(e) =>
                  set("startAt", fromOwnerInput(e.target.value) ?? draft.startAt)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-end">Ends</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={toOwnerInput(draft.endAt)}
                onChange={(e) => set("endAt", fromOwnerInput(e.target.value))}
                aria-invalid={badOrder}
              />
              {badOrder ? (
                <p role="alert" className="text-xs text-destructive">
                  An event cannot end before it starts.
                </p>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Times are {OWNER_TIME_ZONE}. Leaving the end empty makes this a point in time —
            a deadline rather than a meeting.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Context</Label>
              <Select
                value={draft.contextId}
                onValueChange={(value) => set("contextId", value ?? draft.contextId)}
              >
                <SelectTrigger className="w-full">
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
                  set("status", (value as EventStatus) ?? draft.status)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={draft.location ?? ""}
                onChange={(e) =>
                  set("location", e.target.value === "" ? null : e.target.value)
                }
                placeholder="Room, link, or nothing"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Person</Label>
              <Select
                value={draft.personId ?? NOBODY}
                onValueChange={(value) =>
                  set("personId", !value || value === NOBODY ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value === NOBODY || !value
                        ? "Nobody"
                        : (personById.get(String(value))?.displayName ?? "Nobody")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Nobody</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!external ? (
            <Label
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border px-3 py-2.5",
                alsoGoogle && "bg-muted/50",
              )}
            >
              <Switch
                checked={alsoGoogle}
                onCheckedChange={(checked) => setAlsoGoogle(checked === true)}
              />
              <span className="space-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarSyncIcon className="size-3.5" /> Also put it on Google Calendar
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Queues a proposed action. Nothing is sent until you approve it.
                </span>
              </span>
            </Label>
          ) : null}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {external
              ? "Queue change for review"
              : isEdit
                ? "Save changes"
                : alsoGoogle
                  ? "Create and queue"
                  : "Create event"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
