import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">No such screen</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Warp has six surfaces: the dashboard, work items, the schedule, the audit log,
        reports, and settings.
      </p>
      <Button size="sm" nativeButton={false} render={<Link href="/">Back to the dashboard</Link>} />
    </div>
  )
}
