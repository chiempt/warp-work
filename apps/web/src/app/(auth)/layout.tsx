import { KineticText } from "@/components/ui/kinetic-text"
import { WarpThreads } from "@/components/warp/warp-threads"
import { cn } from "@/lib/utils"

/**
 * The shell both auth screens share: the product on the left, the door on the right.
 *
 * The left panel is the product's own metaphor (context doc §12) — the warp threads of a
 * loom, with seven of them lit in the context kind colours and grouped the way the
 * contexts nest. Nothing about it moves.
 *
 * It carries the app's dark tokens whatever the viewer's theme: the `dark` class
 * redefines the custom properties on the element itself, so `--border` and
 * `--context-work` inside it are the dark ones. Nothing is hard-coded.
 *
 * Below `lg` the panel collapses to a header so the form is never under a fold.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full min-w-0 grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
      <aside
        className={cn(
          "dark relative isolate flex min-w-0 flex-col overflow-hidden",
          "bg-background px-6 py-7 text-foreground",
          "lg:justify-between lg:px-14 lg:py-14",
        )}
      >
        <WarpThreads />

        {/* `min-w-0` + `truncate`: without them this row's min-content width becomes the
            floor for the whole grid on a narrow screen. */}
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

        {/* Hover-only letter weighting. Nothing moves on its own. */}
        <KineticText
          as="h1"
          text="Warp"
          className="relative hidden text-5xl leading-none tracking-[-0.045em] [font-optical-sizing:auto] lg:flex"
        />

        <div className="relative hidden max-w-sm lg:block">
          <p className="text-lg leading-snug tracking-tight text-balance">
            In weaving, the warp is the set of threads held under tension — the frame
            every other thread is woven into.
          </p>
          <p className="mt-4 border-t border-border pt-4 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Seven contexts · single user · Asia/Ho_Chi_Minh
          </p>
        </div>

        <p className="relative mt-4 text-xs text-muted-foreground lg:hidden">
          Single user · phase 1 · Asia/Ho_Chi_Minh
        </p>
      </aside>

      <main className="flex min-w-0 items-center justify-center px-6 py-12 lg:px-14">
        {children}
      </main>
    </div>
  )
}
