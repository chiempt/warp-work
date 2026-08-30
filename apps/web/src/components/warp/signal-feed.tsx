import { SignalRow } from "@/components/warp/signal-row"
import type { Signal } from "@/lib/mock/types"

/**
 * Incoming signals, newest first.
 *
 * Deliberately still. A reveal was tried here and cut: this panel is read every
 * morning, and any animation that starts from `opacity: 0` means the list is briefly —
 * or, if motion fails, permanently — empty. Motion in Warp belongs where it marks a
 * transition (session clock-in, the end-of-session report), not where it gates content.
 */
export function SignalFeed({ signals }: { signals: Signal[] }) {
  const newestFirst = [...signals].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )

  return (
    <div className="flex flex-col gap-2">
      {newestFirst.map((signal) => (
        <SignalRow key={signal.id} signal={signal} />
      ))}
    </div>
  )
}
