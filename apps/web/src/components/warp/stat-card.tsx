import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * A counted fact, with the sentence that makes it actionable underneath.
 *
 * The number is rendered, not animated. A count-up was tried and cut — these four
 * numbers are the first thing read every morning, and a ticker that has not finished
 * (or never starts) shows a confident, wrong `0`.
 */
export function StatCard({
  label,
  value,
  caption,
  tone = "default",
  suffix,
}: {
  label: string
  value: number
  caption: string
  /** `urgent` is red, and red means already late — not merely worth a look. */
  tone?: "default" | "urgent"
  suffix?: string
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 flex items-baseline gap-1 text-2xl font-semibold tabular-nums",
            tone === "urgent" && "text-destructive",
          )}
        >
          {value.toLocaleString("en-GB")}
          {suffix ? (
            <span className="text-sm font-normal text-muted-foreground">{suffix}</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  )
}
