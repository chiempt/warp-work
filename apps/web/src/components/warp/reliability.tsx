import { AlertTriangleIcon, CircleCheckIcon, PencilLineIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { accounts } from "@/lib/mock/data"
import type { Account, AccountReliability } from "@/lib/mock/types"

const copy: Record<AccountReliability, { label: string; hint: string }> = {
  official: {
    label: "official",
    hint: "Documented vendor API. Completeness can be trusted while the account is healthy.",
  },
  manual: {
    label: "manual",
    hint: "Entered or forwarded by the owner. Complete only as far as the owner went.",
  },
  unofficial: {
    label: "unofficial",
    hint: "No documented API. Out of scope in Warp — this tier should never appear.",
  },
}

export function ReliabilityBadge({
  reliability,
}: {
  reliability: AccountReliability
}) {
  const Icon =
    reliability === "official"
      ? CircleCheckIcon
      : reliability === "manual"
        ? PencilLineIcon
        : AlertTriangleIcon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-normal",
              reliability === "official" && "text-reliability-official",
              reliability === "manual" && "text-reliability-manual",
              reliability === "unofficial" && "text-reliability-unofficial",
            )}
          >
            <Icon />
            {copy[reliability].label}
          </Badge>
        }
      />
      <TooltipContent className="max-w-64">{copy[reliability].hint}</TooltipContent>
    </Tooltip>
  )
}

export function degradedAccounts(): Account[] {
  return accounts.filter(
    (a) => a.status === "needs_reauth" || a.status === "error",
  )
}

/**
 * The standing rule from CLAUDE.md: anything derived from a failing source says so.
 * This banner sits above the data it qualifies, never in a corner, and never as a toast
 * the owner can miss.
 */
export function DegradedSourceNotice({
  degraded = degradedAccounts(),
  scope,
  className,
}: {
  degraded?: Account[]
  scope: string
  className?: string
}) {
  if (degraded.length === 0) return null

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {scope} may be incomplete
        </p>
        <ul className="space-y-0.5 text-muted-foreground">
          {degraded.map((a) => (
            <li key={a.id}>
              <span className="text-foreground">{a.displayName}</span> —{" "}
              {a.status === "needs_reauth"
                ? "needs re-authorisation"
                : "erroring"}
              {a.lastError ? `: ${a.lastError}` : null}. Sync stopped rather than
              returning partial data.
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
