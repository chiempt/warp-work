import type { Metadata } from "next"

import { DotPattern } from "@/components/ui/dot-pattern"
import { KineticText } from "@/components/ui/kinetic-text"
import { IngestDiagram } from "@/components/warp/ingest-diagram"
import { LoginForm } from "@/components/warp/login-form"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Sign in · Warp",
}

/**
 * Two panels, an even split: the system on the left, the door on the right.
 *
 * The left panel is three zones and nothing else — logotype, figure, one line. An
 * earlier pass had seven stacked blocks and the figure in a bordered card, which read as
 * a document with a widget dropped into it. The figure is now the panel: it bleeds past
 * the padding to the edges, and everything else is set quietly around it.
 *
 * The panel carries the app's dark tokens regardless of the viewer's theme — the `dark`
 * class redefines the custom properties on the element itself, so everything inside is
 * still `bg-card`, `text-muted-foreground`, `--context-work`. Nothing is hard-coded, and
 * the two halves read as one product.
 *
 * There is no photograph. A stock image is the least specific thing this screen could
 * say; the figure says something true instead — every source Warp ingests from, and by
 * omission every one it never will.
 *
 * Below `lg` the panel collapses to a header so the form is never under a fold.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-dvh w-full min-w-0 grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
      <aside
        className={cn(
          "dark relative isolate flex min-w-0 flex-col overflow-hidden",
          "bg-background px-6 py-7 text-foreground",
          "lg:grid lg:grid-rows-[auto_1fr_auto] lg:px-14 lg:py-12",
        )}
      >
        <DotPattern
          width={26}
          height={26}
          cr={0.7}
          className={cn(
            "text-foreground/20",
            "[mask-image:radial-gradient(65%_55%_at_50%_45%,black,transparent)]",
          )}
        />

        {/* `min-w-0` + `truncate`: without them this row's min-content width becomes the
            floor for the whole grid on a narrow screen. The wordmark is spoken-only at
            `lg`, where the logotype says it at full size instead. */}
        <div className="relative flex min-w-0 items-center gap-2.5 lg:hidden">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-xs font-semibold text-primary-foreground"
          >
            W
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Warp</p>
            <p className="truncate text-xs text-muted-foreground">
              The frame that holds everything together
            </p>
          </div>
        </div>

        {/*
          The logotype. `KineticText` weights each letter under the cursor and eases its
          neighbours — nothing moves on its own, so it is an affordance rather than an
          animation, and the one place in Warp where the product is a piece of type
          rather than a label.
        */}
        <KineticText
          as="h1"
          text="Warp"
          className="relative hidden text-4xl leading-none tracking-[-0.045em] [font-optical-sizing:auto] lg:flex"
        />

        {/* The figure is the panel, so it runs past the padding rather than sitting in
            a box drawn on top of it. The width has to grow with the negative margin —
            `w-full` alone would shift the figure left instead of widening it. */}
        <div className="relative hidden items-center lg:flex">
          <IngestDiagram className="-mx-6 w-[calc(100%+3rem)] py-10" />
        </div>

        <div className="relative hidden max-w-sm space-y-2 lg:block">
          <p className="text-sm leading-relaxed text-balance">
            Every source you are allowed to read, routed to the life area it belongs to.
          </p>
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Single user · Phase 1 · Asia/Ho_Chi_Minh
          </p>
        </div>

        <p className="relative mt-4 text-xs text-muted-foreground lg:hidden">
          Single user · phase 1 · Asia/Ho_Chi_Minh
        </p>
      </aside>

      <main className="flex min-w-0 items-center justify-center px-6 py-12 lg:px-14">
        <LoginForm />
      </main>
    </div>
  )
}
