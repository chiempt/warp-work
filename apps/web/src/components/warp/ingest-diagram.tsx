"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"
import { PencilLineIcon } from "lucide-react"

import { AnimatedBeam } from "@/components/ui/animated-beam"
import { cn } from "@/lib/utils"
import {
  CalendarMark,
  DriveMark,
  GmailMark,
  MessengerMark,
  ZaloOaMark,
} from "@/components/warp/source-marks"

function Node({
  ref,
  label,
  align = "start",
  className,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>
  label: string
  align?: "start" | "end"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        align === "end" && "flex-row-reverse",
      )}
    >
      <div
        ref={ref}
        className={cn(
          "z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card p-3",
          className,
        )}
      >
        {children}
      </div>
      <span
        className={cn(
          "text-[11px] tracking-wide whitespace-nowrap text-muted-foreground",
          align === "end" && "text-right",
        )}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * The architecture of context doc §5, drawn rather than described: every source Warp can
 * legitimately read resolves into one frame.
 *
 * It is the figure on the login screen, and it earns the space by being true — the six
 * nodes are exactly the adapters that exist, so the ones missing from it (Zalo personal,
 * Facebook personal messages) are missing on purpose.
 *
 * Labels sit beside their nodes rather than under them: with six of them, a caption under
 * every circle turns the figure into a table. The beams all run inward, so the whole
 * thing reads as convergence. Under `prefers-reduced-motion` the connectors stay and the
 * travelling highlight stops.
 */
export function IngestDiagram({ className }: { className?: string }) {
  const container = React.useRef<HTMLDivElement>(null)
  const gmail = React.useRef<HTMLDivElement>(null)
  const calendar = React.useRef<HTMLDivElement>(null)
  const drive = React.useRef<HTMLDivElement>(null)
  const zalo = React.useRef<HTMLDivElement>(null)
  const page = React.useRef<HTMLDivElement>(null)
  const manual = React.useRef<HTMLDivElement>(null)
  const warp = React.useRef<HTMLDivElement>(null)

  const reduced = useReducedMotion()

  const beam = {
    containerRef: container,
    toRef: warp,
    pathColor: "var(--border)",
    pathWidth: 1,
    pathOpacity: 1,
    gradientStartColor: "var(--muted-foreground)",
    gradientStopColor: "var(--context-work)",
    duration: reduced ? 0 : 4,
    repeat: reduced ? 0 : Infinity,
  } as const

  return (
    <div
      ref={container}
      className={cn("relative flex w-full items-center justify-center", className)}
    >
      {/* A light behind the centre, so the eye lands there first. */}
      <div
        aria-hidden
        className="pointer-events-none absolute size-56 rounded-full bg-foreground/[0.07] blur-3xl"
      />

      <div className="flex w-full flex-col justify-between gap-14">
        <div className="flex items-start justify-between">
          <Node ref={gmail} label="Gmail">
            <GmailMark />
          </Node>
          <Node ref={calendar} label="Calendar" align="end">
            <CalendarMark />
          </Node>
        </div>

        <div className="flex items-center justify-between">
          <Node ref={drive} label="Drive">
            <DriveMark />
          </Node>

          <div
            ref={warp}
            className="z-10 flex size-16 shrink-0 items-center justify-center rounded-full bg-primary ring-8 ring-background"
          >
            <span
              aria-hidden
              className="font-mono text-lg font-semibold text-primary-foreground"
            >
              W
            </span>
          </div>

          <Node ref={zalo} label="Zalo OA" align="end">
            <ZaloOaMark />
          </Node>
        </div>

        <div className="flex items-end justify-between">
          <Node ref={manual} label="Manual entry">
            <PencilLineIcon className="size-full text-muted-foreground" />
          </Node>
          <Node ref={page} label="Facebook Page" align="end">
            <MessengerMark />
          </Node>
        </div>
      </div>

      <AnimatedBeam {...beam} fromRef={gmail} curvature={-80} endYOffset={-12} />
      <AnimatedBeam {...beam} fromRef={drive} />
      <AnimatedBeam {...beam} fromRef={manual} curvature={80} endYOffset={12} />
      <AnimatedBeam
        {...beam}
        fromRef={calendar}
        curvature={-80}
        endYOffset={-12}
        reverse
      />
      <AnimatedBeam {...beam} fromRef={zalo} reverse />
      <AnimatedBeam
        {...beam}
        fromRef={page}
        curvature={80}
        endYOffset={12}
        reverse
      />
    </div>
  )
}
