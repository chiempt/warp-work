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
import {
  contexts,
  contextById,
  NOW,
  people,
  personById,
  signalById,
} from "@/lib/mock/data"
import { formatDay, fromOwnerInput, OWNER_TIME_ZONE, toOwnerInput } from "@/lib/format"
import type {
  Commitment,
  CommitmentDirection,
  CommitmentStatus,
} from "@/lib/mock/types"

const STATUSES: CommitmentStatus[] = ["open", "fulfilled", "waived", "dropped"]

const blank = (): Commitment => ({
  id: "",
  contextId: contexts[0].id,
  personId: people[0].id,
  direction: "i_owe",
  what: "",
  promisedAt: NOW,
  dueAt: null,
  status: "open",
  evidenceSignalId: null,
})

/**
 * Create or edit a commitment.
 *
 * Extraction only writes a commitment when a signal proves one was made — that rule is
 * what keeps the table trustworthy, and it does not change. But a promise made on a phone
 * call leaves no signal, and losing it is worse than recording it, so the owner can enter
 * one by hand. It is saved with no evidence and shown as *recorded by hand* everywhere it
 * appears, which keeps the distinction the rule was protecting.
 *
 * `direction` has exactly two values and there is no third case.
 */
export function CommitmentForm({
  commitment,
  open,
  onOpenChange,
  onSave,
}: {
  /** Null creates; a commitment edits it. */
  commitment: Commitment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (commitment: Commitment) => void
}) {
  const isEdit = commitment !== null
  const [draft, setDraft] = React.useState<Commitment>(commitment ?? blank())

  const seed = commitment?.id ?? "new"
  const [seededFor, setSeededFor] = React.useState(seed)
  if (seededFor !== seed) {
    setSeededFor(seed)
    setDraft(commitment ?? blank())
  }

  const set = <K extends keyof Commitment>(key: K, value: Commitment[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const valid = draft.what.trim() !== ""
  const evidence = draft.evidenceSignalId
    ? signalById.get(draft.evidenceSignalId)
    : undefined

  const save = () => {
    if (!valid) return
    onSave({ ...draft, what: draft.what.trim() })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit commitment" : "Record a commitment"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Changes apply to this record. The signal behind it, if any, is never modified."
              : "A promise with no signal behind it — a call, a corridor conversation. It will be marked as recorded by hand."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["i_owe", "owed_to_me"] as CommitmentDirection[]).map((direction) => (
                <Button
                  key={direction}
                  type="button"
                  variant={draft.direction === direction ? "default" : "outline"}
                  onClick={() => set("direction", direction)}
                >
                  {direction === "i_owe" ? "I owe" : "Owed to me"}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-what">What was promised</Label>
            <Textarea
              id="commitment-what"
              rows={2}
              value={draft.what}
              onChange={(e) => set("what", e.target.value)}
              placeholder="The thing itself, in the words it was promised in"
              aria-invalid={draft.what.trim() === ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{draft.direction === "i_owe" ? "Owed to" : "Owed by"}</Label>
              <Select
                value={draft.personId}
                onValueChange={(value) => set("personId", value ?? draft.personId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => personById.get(String(value))?.displayName ?? "Choose"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="commitment-promised">Promised</Label>
              <Input
                id="commitment-promised"
                type="datetime-local"
                value={toOwnerInput(draft.promisedAt)}
                onChange={(e) =>
                  set("promisedAt", fromOwnerInput(e.target.value) ?? draft.promisedAt)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commitment-due">Due</Label>
              <Input
                id="commitment-due"
                type="datetime-local"
                value={toOwnerInput(draft.dueAt)}
                onChange={(e) => set("dueAt", fromOwnerInput(e.target.value))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Times are {OWNER_TIME_ZONE}. A commitment with no due date is still tracked —
            it simply never becomes overdue.
          </p>

          {isEdit ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  set("status", (value as CommitmentStatus) ?? draft.status)
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
          ) : null}

          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Evidence
            </p>
            {evidence ? (
              <>
                <p className="mt-1 text-sm">{evidence.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {evidence.from} · {formatDay(evidence.occurredAt)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                None. This one is recorded by hand, and every screen that shows it says so.
              </p>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {isEdit ? "Save changes" : "Record commitment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
