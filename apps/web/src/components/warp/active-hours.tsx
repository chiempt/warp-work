import { FlagIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextChip } from "@/components/warp/context-chip"
import { cn } from "@/lib/utils"
import { contexts } from "@/lib/mock/data"

/**
 * `contexts.active_hours`, read beside the schedule.
 *
 * This is the answer to "why is none of my coursework showing up on a Tuesday" — the
 * schedule is not the whole truth, it is the whole truth *inside the hours each context
 * is awake*. A calendar that hides things without saying why is a calendar you stop
 * trusting, so the rule sits next to the grid rather than buried in settings.
 */
export function ActiveHours({ className }: { className?: string }) {
  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader>
        <CardTitle className="text-sm">Active hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs leading-relaxed text-muted-foreground">
          A context stays quiet outside its hours. This is why coursework does not surface
          at 10:00 on a Tuesday, and why a session scoped to work never raises the fitness
          log.
        </p>

        <ul className="space-y-2">
          {contexts.map((context) => (
            <li key={context.id} className="flex items-start justify-between gap-3">
              <ContextChip contextId={context.id} showParent />
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {context.activeHours}
              </span>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <FlagIcon className="mt-0.5 size-3.5 shrink-0" />
          Solid blocks are events from a calendar. Dashed ones are dates Warp derived — a
          task due, or a promise coming up.
        </p>
      </CardContent>
    </Card>
  )
}
