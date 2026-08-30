import { PageHeader } from "@/components/warp/page-header"
import { DegradedSourceNotice } from "@/components/warp/reliability"
import { WorkItemsView } from "@/components/warp/work-items-view"

export default async function WorkItemsPage(props: PageProps<"/work-items">) {
  const params = await props.searchParams
  const tab = typeof params.tab === "string" ? params.tab : "tasks"
  const context = typeof params.context === "string" ? params.context : undefined

  return (
    <>
      <PageHeader
        title="Work items"
        description="Tasks and commitments, most of them derived from signals. Anything extraction missed — a promise made on a call, a job nobody wrote down — can be recorded by hand and is marked as such."
      />
      <DegradedSourceNotice scope="This list" />
      <WorkItemsView initialTab={tab} initialContextSlug={context} />
    </>
  )
}
