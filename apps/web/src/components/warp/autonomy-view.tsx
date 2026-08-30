"use client"

import * as React from "react"
import { LockIcon, TrendingUpIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ContextChip } from "@/components/warp/context-chip"
import { AutonomyBadge, RiskBadge } from "@/components/warp/status-badge"
import { autonomyRules } from "@/lib/mock/data"
import { formatDay } from "@/lib/format"
import type { AutonomyLevel, AutonomyRule } from "@/lib/mock/types"

/**
 * Phase 4 gate. The enum carries `auto`; the interface offers `ask` and `draft` and
 * nothing else, and the control that would set it is disabled with the reason on it.
 * The matching guard lives in the API — this is the second lock, not the only one.
 */
const SELECTABLE_LEVELS: AutonomyLevel[] = ["ask", "draft"]

export function AutonomyView() {
  const [levels, setLevels] = React.useState<Record<string, AutonomyLevel>>(
    Object.fromEntries(
      autonomyRules.map((r) => [key(r), r.level] as const),
    ),
  )
  const [raising, setRaising] = React.useState<AutonomyRule | null>(null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How trust is granted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Autonomy is a property of the pair{" "}
            <span className="text-foreground">(context, action type)</span> — never a
            global switch, never a per-source one. Drafting a reply for Remote job A can
            be routine while the same action for the main company job still needs asking.
          </p>
          <p>
            Everything starts at <span className="text-foreground">draft</span>. A level
            rises only after a run of approvals with no edits, and only when you accept
            the proposal — Warp never promotes itself.
          </p>
          <p className="flex items-center gap-2 text-xs">
            <LockIcon className="size-3.5" />
            <span>
              The <span className="font-mono">auto</span> level exists in the schema and
              is unreachable in this build. It opens in phase 4, once phases 1–3 have run
              against real traffic.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Context</TableHead>
              <TableHead className="w-40">Action type</TableHead>
              <TableHead className="w-28">Risk</TableHead>
              <TableHead className="w-56">Evidence</TableHead>
              <TableHead className="w-28">Level</TableHead>
              <TableHead className="w-32 text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {autonomyRules.map((rule) => {
              const id = key(rule)
              const level = levels[id]
              const evidenceMet = rule.evidenceClean >= rule.evidenceThreshold
              // `ask` → `draft` is the only promotion this build can offer. A rule
              // already at `draft` with enough evidence is waiting on phase 4, and the
              // row says so instead of dangling a button that would change nothing.
              const canRaise = evidenceMet && level === "ask"
              const waitingOnPhase4 = evidenceMet && level === "draft"
              const pct = Math.min(
                100,
                Math.round((rule.evidenceClean / rule.evidenceThreshold) * 100),
              )

              return (
                <TableRow key={id}>
                  <TableCell>
                    <ContextChip contextId={rule.contextId} showParent />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{rule.actionType}</TableCell>
                  <TableCell>
                    <RiskBadge risk={rule.risk} />
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div className="w-full cursor-help space-y-1">
                            <Progress value={pct} className="gap-1">
                              <ProgressTrack>
                                <ProgressIndicator />
                              </ProgressTrack>
                            </Progress>
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {rule.evidenceClean}/{rule.evidenceThreshold} clean
                            </p>
                          </div>
                        }
                      />
                      <TooltipContent className="max-w-64">
                        Consecutive approvals with no edit. One edit or rejection resets
                        the count — the threshold scales with how much damage the action
                        can do.
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <AutonomyBadge level={level} />
                      {canRaise ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label="Raise to draft"
                          onClick={() => setRaising(rule)}
                        >
                          <TrendingUpIcon />
                        </Button>
                      ) : null}
                      {waitingOnPhase4 ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            }
                          />
                          <TooltipContent className="max-w-64">
                            Evidence threshold met. The next level up is{" "}
                            <span className="font-mono">auto</span>, which opens in phase
                            4 — nothing to raise yet.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDay(rule.updatedAt)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={raising !== null}
        onOpenChange={(open) => !open && setRaising(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Raise this level?</AlertDialogTitle>
            <AlertDialogDescription>
              {raising ? (
                <>
                  <span className="font-mono">{raising.actionType}</span> has{" "}
                  {raising.evidenceClean} consecutive approvals with no edit. Raising it
                  from <span className="font-mono">{levels[key(raising)]}</span> to{" "}
                  <span className="font-mono">draft</span> means Warp prepares the action
                  without asking first — it still does not send it. The{" "}
                  <span className="font-mono">auto</span> level, which would send, is not
                  available in this build.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Leave it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!raising) return
                const next = SELECTABLE_LEVELS[SELECTABLE_LEVELS.length - 1]
                setLevels((l) => ({ ...l, [key(raising)]: next }))
                setRaising(null)
              }}
            >
              Raise to draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const key = (rule: AutonomyRule) => `${rule.contextId}:${rule.actionType}`
