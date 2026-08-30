"use client"

import * as React from "react"
import {
  CheckIcon,
  MailIcon,
  CalendarPlusIcon,
  MessageSquareIcon,
  PencilIcon,
  TableIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ContextChip, ContextRail } from "@/components/warp/context-chip"
import { AutonomyBadge, RiskBadge } from "@/components/warp/status-badge"
import { EmptyState } from "@/components/warp/states"
import { cn } from "@/lib/utils"
import { contextById, NOW, proposedActions } from "@/lib/mock/data"
import { formatRelative } from "@/lib/format"
import type { ProposedAction } from "@/lib/mock/types"

const kindIcon = {
  send_email: MailIcon,
  send_message: MessageSquareIcon,
  create_event: CalendarPlusIcon,
  update_record: TableIcon,
} as const

const kindVerb = {
  send_email: "Send email",
  send_message: "Send message",
  create_event: "Create calendar event",
  update_record: "Update record",
} as const

type Decision = "approved" | "edited" | "rejected"

/**
 * The review queue — the single most-used interaction in the product, so it is built for
 * batch keyboard work: j/k to move, e to edit, a to approve, r to reject.
 *
 * Approving is the moment something leaves the system. It goes through `AlertDialog`,
 * never `Dialog`, and the dialog names the recipient, because that is the fact the owner
 * gets wrong when moving fast.
 */
export function ReviewQueue({ actions = proposedActions }: { actions?: ProposedAction[] }) {
  const pending = React.useMemo(
    () => actions.filter((a) => a.status === "pending"),
    [actions],
  )

  const [decided, setDecided] = React.useState<Record<string, Decision>>({})
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [editing, setEditing] = React.useState<string | null>(null)
  const [cursor, setCursor] = React.useState(0)
  const [confirming, setConfirming] = React.useState<ProposedAction | null>(null)

  const queue = pending.filter((a) => !decided[a.id])
  const active = queue[Math.min(cursor, Math.max(queue.length - 1, 0))]

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active || confirming) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "TEXTAREA" || tag === "INPUT") return

      if (e.key === "j") setCursor((c) => Math.min(c + 1, queue.length - 1))
      if (e.key === "k") setCursor((c) => Math.max(c - 1, 0))
      if (e.key === "e") {
        e.preventDefault()
        setEditing(active.id)
      }
      if (e.key === "a") {
        e.preventDefault()
        setConfirming(active)
      }
      if (e.key === "r") {
        e.preventDefault()
        setDecided((d) => ({ ...d, [active.id]: "rejected" }))
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [active, confirming, queue.length])

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={CheckIcon}
        title="Review queue clear"
        description={
          Object.keys(decided).length > 0
            ? "Everything drafted this session has been decided. Approved actions are recorded in the audit log with an undo reference."
            : "Nothing is waiting on you. Agents draft only inside an open session, so this stays empty until one is running."
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {queue.length} action{queue.length === 1 ? "" : "s"} waiting · nothing has been
          sent
        </span>
        <span className="hidden font-mono sm:inline">
          j/k move · e edit · a approve · r reject
        </span>
      </div>

      {queue.map((action, index) => {
        const Icon = kindIcon[action.kind]
        const context = contextById.get(action.contextId)
        const isActive = active?.id === action.id
        const body = drafts[action.id] ?? action.body
        const isEdited = body !== action.body

        return (
          <article
            key={action.id}
            onClick={() => setCursor(index)}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-card pl-4 transition-colors",
              isActive ? "ring-1 ring-ring" : "hover:bg-muted/40",
            )}
          >
            <ContextRail contextId={action.contextId} />

            <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{kindVerb[action.kind]}</span>
              <span className="text-sm text-muted-foreground">to</span>
              <span className="text-sm font-medium">{action.recipient}</span>
              <div className="ml-auto flex items-center gap-2">
                <ContextChip contextId={action.contextId} />
                <RiskBadge risk={action.risk} />
                <AutonomyBadge level={action.autonomyLevelApplied} />
              </div>
            </div>

            <div className="px-3 pt-2 pb-3">
              <p className="text-sm font-medium">{action.subject}</p>

              {editing === action.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    autoFocus
                    rows={8}
                    value={body}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [action.id]: e.target.value }))
                    }
                    className="font-sans text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                      Done editing
                    </Button>
                    {isEdited ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDrafts((d) => {
                            const next = { ...d }
                            delete next[action.id]
                            return next
                          })
                        }}
                      >
                        <Undo2Icon /> Revert to draft
                      </Button>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      Your edit is kept beside the original — the difference is what
                      teaches the autonomy ladder.
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 max-w-3xl text-sm whitespace-pre-line text-muted-foreground">
                  {body}
                </p>
              )}

              {context ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tone profile applied: {context.toneProfile}
                </p>
              ) : null}

              <Separator className="my-3" />

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setConfirming(action)}>
                  <CheckIcon /> {isEdited ? "Approve edited" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(editing === action.id ? null : action.id)}
                >
                  <PencilIcon /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDecided((d) => ({ ...d, [action.id]: "rejected" }))
                  }
                >
                  <XIcon /> Reject
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">
                  drafted {formatRelative(action.createdAt, NOW)}
                </span>
              </div>
            </div>
          </article>
        )
      })}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.kind === "update_record"
                ? "Write this change to the record?"
                : "Send this now?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.kind === "update_record" ? (
                <>
                  This writes to{" "}
                  <span className="text-foreground">{confirming?.recipient}</span> outside
                  Warp. An undo reference is stored with the execution.
                </>
              ) : (
                <>
                  This leaves Warp and arrives at{" "}
                  <span className="text-foreground">{confirming?.recipient}</span> as{" "}
                  {contextById.get(confirming?.contextId ?? "")?.name}. An undo token is
                  stored, valid for 30 minutes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirming) return
                const wasEdited =
                  (drafts[confirming.id] ?? confirming.body) !== confirming.body
                setDecided((d) => ({
                  ...d,
                  [confirming.id]: wasEdited ? "edited" : "approved",
                }))
                setConfirming(null)
                setCursor(0)
              }}
            >
              {confirming?.kind === "update_record" ? "Write it" : "Send it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
