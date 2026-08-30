import { PageHeader } from "@/components/warp/page-header"
import { DegradedSourceNotice } from "@/components/warp/reliability"
import { ScheduleView } from "@/components/warp/schedule-view"
import { OWNER_TIME_ZONE } from "@/lib/format"

export default async function SchedulePage(props: PageProps<"/schedule">) {
  const params = await props.searchParams
  const mode = typeof params.view === "string" ? params.view : undefined
  const range = typeof params.range === "string" ? params.range : undefined

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`Events, task due dates, and commitment deadlines on one clock. Times are ${OWNER_TIME_ZONE}; everything is stored in UTC and converted here.`}
      />
      <DegradedSourceNotice scope="This schedule" />
      <ScheduleView initialMode={mode} initialRange={range} />
    </>
  )
}
