"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ContextChip } from "@/components/warp/context-chip"
import { ContextForm } from "@/components/warp/context-form"
import { useContexts } from "@/components/warp/contexts-provider"
import { accounts, autonomyRules } from "@/lib/mock/data"
import type { Context } from "@/lib/mock/types"

/**
 * Contexts are the axis, so this is the closest thing Warp has to a settings root.
 * The tone profile is edited here and nowhere else — it is what stops the register used
 * with a manager from reaching a training partner.
 */
export function ContextsView() {
  const { contexts } = useContexts()
  const [form, setForm] = React.useState<{ open: boolean; context: Context | null }>({
    open: false,
    context: null,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Contexts nest, and a child inherits its parent&apos;s defaults until it
          overrides them. Everything — signals, tasks, people, memory notes, autonomy —
          hangs off one of these.
        </p>
        <Button size="sm" onClick={() => setForm({ open: true, context: null })}>
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
                        preview={{ name: context.name, kind: context.kind }}
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
                      onClick={() => setForm({ open: true, context })}
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

      <ContextForm
        context={form.context}
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
      />
    </div>
  )
}
