"use client"

import { ErrorState } from "@/components/warp/states"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="This screen could not be loaded"
      detail={
        error.digest
          ? `${error.message} (digest ${error.digest})`
          : error.message ||
            "The API did not answer. Nothing was sent and nothing was changed — Warp fails closed."
      }
      onRetry={reset}
    />
  )
}
