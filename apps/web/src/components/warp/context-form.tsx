"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"

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
import { ContextChip } from "@/components/warp/context-chip"
import { slugify, useContexts } from "@/components/warp/contexts-provider"
import { cn } from "@/lib/utils"
import type { Context, ContextKind } from "@/lib/mock/types"

const KINDS: ContextKind[] = ["work", "study", "personal"]
const NO_PARENT = "__root__"

/** `contexts_slug_format` in the migration. Enforced here so the two agree. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

const blank = (): Context => ({
  id: "",
  parentId: null,
  slug: "",
  name: "",
  kind: "work",
  toneProfile: "",
  activeHours: "",
})

/**
 * Create or edit a context.
 *
 * This is the one form in Warp where the record being written is the axis everything
 * else hangs off — signals, tasks, people, memory notes and autonomy rules all carry a
 * `context_id`. So it asks for the two things that actually change behaviour, rather
 * than a name and nothing else:
 *
 *   - **Active hours**, which decide when this context is allowed to surface at all.
 *   - **Tone profile**, which is injected into every draft written for it and never
 *     leaks into another.
 *
 * The slug follows the name until it is edited by hand, and is validated against the
 * same pattern the database enforces.
 */
export function ContextForm({
  context,
  open,
  onOpenChange,
}: {
  /** Null creates; a context edits it. */
  context: Context | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { contexts, create, save } = useContexts()
  const [pending, setPending] = React.useState(false)
  const [failure, setFailure] = React.useState<string | null>(null)
  const isEdit = context !== null

  const [draft, setDraft] = React.useState<Context>(context ?? blank())
  const [slugTouched, setSlugTouched] = React.useState(false)

  const seed = context?.id ?? "new"
  const [seededFor, setSeededFor] = React.useState(seed)
  if (seededFor !== seed) {
    setSeededFor(seed)
    setDraft(context ?? blank())
    setSlugTouched(isEdit)
  }

  const set = <K extends keyof Context>(key: K, value: Context[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const setName = (name: string) =>
    setDraft((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugify(name),
    }))

  // A context cannot be its own parent (`contexts_no_self_parent`), and nesting it
  // under its own descendant would make a cycle the tree cannot render.
  const descendants = React.useMemo(() => {
    const out = new Set<string>()
    const walk = (id: string) => {
      for (const c of contexts) {
        if (c.parentId === id && !out.has(c.id)) {
          out.add(c.id)
          walk(c.id)
        }
      }
    }
    if (draft.id !== "") walk(draft.id)
    return out
  }, [contexts, draft.id])

  const parents = contexts.filter(
    (c) => c.id !== draft.id && !descendants.has(c.id),
  )

  const slugTaken = contexts.some(
    (c) => c.slug === draft.slug && c.id !== draft.id,
  )
  const slugBad = draft.slug !== "" && !SLUG_PATTERN.test(draft.slug)
  const valid =
    draft.name.trim() !== "" && draft.slug !== "" && !slugBad && !slugTaken

  const submit = async () => {
    if (!valid) return

    const next = {
      ...draft,
      name: draft.name.trim(),
      toneProfile: draft.toneProfile.trim(),
      activeHours: draft.activeHours.trim() || "Always",
    }

    // Editing is local: the contract has no update operation yet, so pretending
    // otherwise would show a change that no server ever received.
    if (isEdit) {
      save(next)
      onOpenChange(false)
      return
    }

    setPending(true)
    setFailure(null)

    const result = await create(next)
    setPending(false)

    if (!result.ok) {
      // The sheet stays open with the values intact. A slug collision is fixed by
      // editing one field, not by typing the whole thing again.
      setFailure(result.message)
      return
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit context" : "New context"}</SheetTitle>
          <SheetDescription>
            A life area. Everything Warp holds — signals, tasks, people, memory notes,
            autonomy rules — belongs to one of these.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="context-name">Name</Label>
            <Input
              id="context-name"
              value={draft.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Remote job C"
              aria-invalid={draft.name.trim() === ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  set("kind", (value as ContextKind) ?? draft.kind)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Decides the colour it carries everywhere.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Nested under</Label>
              <Select
                value={draft.parentId ?? NO_PARENT}
                onValueChange={(value) =>
                  set("parentId", !value || value === NO_PARENT ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value === NO_PARENT || !value
                        ? "Nothing — top level"
                        : (contexts.find((c) => c.id === value)?.name ?? "Nothing")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Nothing — top level</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A child inherits its parent&apos;s defaults until it overrides them.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context-slug">Slug</Label>
            <Input
              id="context-slug"
              value={draft.slug}
              onChange={(e) => {
                setSlugTouched(true)
                set("slug", e.target.value)
              }}
              className="font-mono"
              placeholder="remote-c"
              aria-invalid={slugBad || slugTaken}
            />
            <p
              className={cn(
                "text-xs",
                slugBad || slugTaken ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {slugTaken
                ? "Another context already uses this slug."
                : slugBad
                  ? "Lowercase letters, digits, hyphens and underscores; must not start with a hyphen."
                  : "Used in links and filters. Follows the name until you change it."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context-hours">Active hours</Label>
            <Input
              id="context-hours"
              value={draft.activeHours}
              onChange={(e) => set("activeHours", e.target.value)}
              placeholder="Mon–Fri 19:00–22:00"
            />
            <p className="text-xs text-muted-foreground">
              Outside these hours the context stays quiet — no reminders, and nothing
              from it surfaces during a session scoped elsewhere. Empty means always.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context-tone">Tone profile</Label>
            <Textarea
              id="context-tone"
              rows={4}
              value={draft.toneProfile}
              onChange={(e) => set("toneProfile", e.target.value)}
              placeholder="How to write to people here — register, language, anything an agent would otherwise get wrong."
            />
            <p className="text-xs text-muted-foreground">
              Injected into every draft written for this context, and never into another
              one. This is what stops the register kept for a manager reaching a
              training partner.
            </p>
          </div>

          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Appears as
            </p>
            <div className="mt-1.5">
              {draft.name.trim() === "" ? (
                <span className="text-sm text-muted-foreground">
                  Name it to see the marker.
                </span>
              ) : (
                <ContextChip
                  contextId={draft.id}
                  className="text-sm text-foreground"
                  preview={{ name: draft.name, kind: draft.kind }}
                />
              )}
            </div>
          </div>
        </div>

        {failure ? (
          <p
            role="alert"
            className="mx-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {failure}
          </p>
        ) : null}

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? (
              <>
                <LoaderCircleIcon className="animate-spin" /> Creating…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create context"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
