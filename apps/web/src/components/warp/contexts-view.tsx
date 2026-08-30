"use client"

import * as React from "react"
import { ArchiveIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ContextChip } from "@/components/warp/context-chip"
import { accounts, autonomyRules, contexts } from "@/lib/mock/data"
import type { Context } from "@/lib/mock/types"

/**
 * Contexts are the axis, so this is the closest thing Warp has to a settings root.
 * The tone profile is edited here and nowhere else — it is what stops the register used
 * with a manager from reaching a training partner.
 */
export function ContextsView() {
  const [editing, setEditing] = React.useState<Context | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Contexts nest, and a child inherits its parent&apos;s defaults until it
          overrides them. Everything — signals, tasks, people, memory notes, autonomy —
          hangs off one of these.
        </p>
        <Button size="sm" variant="outline">
          <PlusIcon /> New context
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Context</TableHead>
              <TableHead className="w-24">Kind</TableHead>
              <TableHead className="w-52">Active hours</TableHead>
              <TableHead className="w-20 text-center">Sources</TableHead>
              <TableHead className="w-20 text-center">Rules</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contexts.map((context) => {
              const sources = accounts.filter((a) =>
                a.contextIds.includes(context.id),
              ).length
              const rules = autonomyRules.filter(
                (r) => r.contextId === context.id,
              ).length

              return (
                <TableRow key={context.id}>
                  <TableCell>
                    <div className={context.parentId ? "pl-5" : undefined}>
                      <ContextChip
                        contextId={context.id}
                        className="text-sm text-foreground"
                      />
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {context.toneProfile}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {context.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {context.activeHours}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs tabular-nums">
                    {sources}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs tabular-nums">
                    {rules}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(context)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full data-[side=right]:sm:max-w-xl">
          {editing ? (
            <>
              <SheetHeader>
                <SheetTitle>{editing.name}</SheetTitle>
                <SheetDescription>
                  Changes here affect every draft written for this context, and nothing
                  outside it.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ctx-name">Name</Label>
                  <Input id="ctx-name" defaultValue={editing.name} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctx-hours">Active hours</Label>
                  <Input id="ctx-hours" defaultValue={editing.activeHours} />
                  <p className="text-xs text-muted-foreground">
                    Outside these hours the context stays quiet — no reminders, no
                    surfacing during a session scoped elsewhere.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ctx-tone">Tone profile</Label>
                  <Textarea id="ctx-tone" rows={5} defaultValue={editing.toneProfile} />
                  <p className="text-xs text-muted-foreground">
                    Injected into every draft for this context. It never leaks into
                    another one.
                  </p>
                </div>
              </div>

              <SheetFooter>
                <Button variant="ghost" className="mr-auto">
                  <ArchiveIcon /> Archive context
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={() => setEditing(null)}>Save</Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
