import { AuditLogView } from "@/components/warp/audit-log-view"
import { PageHeader } from "@/components/warp/page-header"

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every state change, who caused it, and what it changed. Append-only: entries are never edited or removed, including by Warp itself."
      />
      <AuditLogView />
    </>
  )
}
