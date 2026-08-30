import { Skeleton } from "@/components/ui/skeleton"
import { ListSkeleton } from "@/components/warp/states"

export default function Loading() {
  return (
    <>
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <ListSkeleton rows={5} />
    </>
  )
}
