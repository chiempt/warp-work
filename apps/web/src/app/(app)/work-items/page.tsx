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
        description="Tasks and commitments derived from signals. Nothing here is typed in by hand — if an item is missing, the extraction that should have produced it is what to look at."
      />
      <DegradedSourceNotice scope="This list" />
      <WorkItemsView initialTab={tab} initialContextSlug={context} />
    </>
  )
}
