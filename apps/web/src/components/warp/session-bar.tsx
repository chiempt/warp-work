"use client"

import * as React from "react"
import { CircleStopIcon, PlayIcon, TimerIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ContextChip } from "@/components/warp/context-chip"
import { contexts, NOW, openSession, runs } from "@/lib/mock/data"
import { formatDuration, formatTime } from "@/lib/format"

const runningNow = runs.filter((r) => r.status === "running").length

/**
 * The clock-in switch — §7 of the context doc, and the only control that changes what
 * agents are allowed to touch.
 *
 * UI-only: session state is local. When the API lands this becomes the session resource
 * and the counters stream from it.
 */
export function SessionBar() {
  const [session, setSession] = React.useState<typeof openSession | null>(openSession)
  const [scope, setScope] = React.useState<string[]>(openSession.contextIds)

  if (!session) {
    return <StartSession scope={scope} onScope={setScope} onStart={() => setSession(openSession)} />
  }

  const elapsed = formatDuration(session.startedAt, NOW)

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        {session.contextIds.map((id) => (
          <ContextChip key={id} contextId={id} />
        ))}
      </div>

      <Separator orientation="vertical" className="hidden h-4 md:block" />

      <div
        className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground"
        title={`Session opened ${formatTime(session.startedAt)}`}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-context-work opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-context-work" />
        </span>
        <TimerIcon className="size-3.5" />
        {elapsed}
      </div>

      {/* Plain text, not a ticker: this sits in the chrome on every screen, and a
          counter that reads 0 while it animates up is worse than one that never moves. */}
      <div className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
        <span className="font-mono tabular-nums text-foreground">
          {(session.tokensIn + session.tokensOut).toLocaleString("en-GB")}
        </span>
        tokens
      </div>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="outline" size="sm">
              <CircleStopIcon /> End session
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {runningNow > 0 ? (
                <>
                  <span className="text-foreground">
                    {runningNow} run{runningNow === 1 ? "" : "s"} still in flight
                  </span>{" "}
                  will be cancelled, not left to finish in the background. Pending
                  proposed actions stay pending — nothing is sent.
                </>
              ) : (
                <>
                  Agents stop for these contexts and a session report is generated.
                  Pending proposed actions stay pending — nothing is sent.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={() => setSession(null)}>
              End session and generate report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StartSession({
  scope,
  onScope,
  onStart,
}: {
  scope: string[]
  onScope: (next: string[]) => void
  onStart: () => void
}) {
  const toggle = (id: string) =>
    onScope(scope.includes(id) ? scope.filter((c) => c !== id) : [...scope, id])

  return (
    <div className="flex flex-1 items-center justify-end gap-3">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        No session open — agents are idle
      </span>
      <Dialog>
        <DialogTrigger
          render={
            <Button size="sm">
              <PlayIcon /> Start session
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a work session</DialogTitle>
            <DialogDescription>
              Agents may only read and act inside the contexts you select. Everything
              else stays untouched for the length of the session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            {contexts.map((context) => (
              <Label
                key={context.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
              >
                <Checkbox
                  checked={scope.includes(context.id)}
                  onCheckedChange={() => toggle(context.id)}
                />
                <ContextChip contextId={context.id} className="text-sm text-foreground" />
                <span className="ml-auto text-xs text-muted-foreground">
                  {context.activeHours}
                </span>
              </Label>
            ))}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <DialogClose
              render={
                <Button disabled={scope.length === 0} onClick={onStart}>
                  Clock in to {scope.length} context{scope.length === 1 ? "" : "s"}
                </Button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
