import { cn } from "@/lib/utils"

import { contexts } from "@/lib/mock/data"
import type { ContextKind } from "@/lib/mock/types"

const THREAD_COUNT = 72

const kindStroke: Record<ContextKind, string> = {
  work: "var(--context-work)",
  study: "var(--context-study)",
  personal: "var(--context-personal)",
}

/** Deterministic 0–1. No `Math.random()`: the weave must be identical on both renders. */
function seeded(index: number) {
  let h = Math.imul(index + 1, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Brightness falls off from the middle of the field. Evenly lit, the threads read as
 * corduroy; weighted, they read as a bolt of cloth catching light — and the panel gets a
 * centre for the eye to rest on instead of a wall of stripes.
 */
function centreWeight(index: number, total: number) {
  const offset = (index / (total - 1)) * 2 - 1
  return 0.28 + 0.72 * Math.cos((offset * Math.PI) / 2) ** 2
}

/**
 * The product's own metaphor, drawn (context doc §12): in weaving, the warp is the set of
 * lengthwise threads held under tension on the loom — the frame every other thread is
 * woven into.
 *
 * Most threads are hairlines in the border colour. Seven are not: one per context, in
 * that context's kind colour, spaced across the field in the order they nest. So the
 * figure says the one thing worth saying on this screen — several parallel lives, held
 * under tension, in one frame — without a logo, an arrow, or a word of explanation.
 *
 * Nothing here moves. It is a surface, not an effect.
 */
export function WarpThreads({ className }: { className?: string }) {
  // Seven live threads, laid out the way the contexts actually sit: siblings close
  // together, a wide gap where the kind changes. Evenly spaced they would be seven
  // stripes; grouped, the field shows three work threads, one study thread, and a family
  // of three personal ones — which is the shape of the owner's week.
  const live = new Map<number, (typeof contexts)[number]>()
  let cursor = 14
  contexts.forEach((context, index) => {
    if (index > 0) {
      cursor += contexts[index - 1].kind === context.kind ? 5 : 13
    }
    live.set(cursor, context)
  })

  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      viewBox={`0 0 ${THREAD_COUNT} 100`}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <defs>
        <linearGradient id="warp-threads-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="18%" stopColor="#fff" stopOpacity="1" />
          <stop offset="82%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="warp-threads-mask">
          <rect width={THREAD_COUNT} height="100" fill="url(#warp-threads-fade)" />
        </mask>
      </defs>

      <g mask="url(#warp-threads-mask)">
        {Array.from({ length: THREAD_COUNT }, (_, index) => {
          const context = live.get(index)
          // Uneven tension: a printed grid reads as a texture, a woven one does not.
          const jitter = 0.45 + seeded(index) * 0.55
          const weight = centreWeight(index, THREAD_COUNT)

          return (
            <line
              key={index}
              x1={index + 0.5}
              x2={index + 0.5}
              y1="0"
              y2="100"
              vectorEffect="non-scaling-stroke"
              stroke={context ? kindStroke[context.kind] : "var(--border)"}
              strokeWidth={context ? 1.5 : 1}
              strokeOpacity={
                context ? 0.35 + weight * 0.65 : jitter * weight * 0.6
              }
            />
          )
        })}
      </g>
    </svg>
  )
}
