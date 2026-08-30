import { PageHeader } from "@/components/warp/page-header"
import { ReportView } from "@/components/warp/report-view"

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="What was done, what is waiting, what is blocked, and what is due next — written when a session closes, and once a day."
      />
      <ReportView />
    </>
  )
}
