"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { CONTEXT_PARAM, coveredContexts } from "@/lib/context-scope"

export { CONTEXT_PARAM }

/**
 * The context filter, held in the URL.
 *
 * In the URL rather than in React state for two reasons: the filter survives a reload
 * and can be sent to yourself, and — more importantly — it is the same axis the whole
 * product is organised around, so a screen reached from a link should show what the
 * link said it would.
 *
 * An empty selection means every context. That is the honest default: "no filter" and
 * "all seven selected" are the same view, and making the owner tick seven boxes to see
 * everything is a worse way to say it.
 */
export function useContextFilter() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const selected = React.useMemo(
    () => (params.get(CONTEXT_PARAM) ?? "").split(",").filter(Boolean),
    [params],
  )

  const covered = React.useMemo(() => coveredContexts(selected), [selected])

  const apply = React.useCallback(
    (slugs: string[]) => {
      const next = new URLSearchParams(params)
      if (slugs.length === 0) {
        next.delete(CONTEXT_PARAM)
      } else {
        next.set(CONTEXT_PARAM, slugs.join(","))
      }
      const query = next.toString()
      // The filter stays on the screen the owner is looking at. Jumping them to
      // another one because they narrowed the view is what the old behaviour did.
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const toggle = React.useCallback(
    (slug: string) =>
      apply(
        selected.includes(slug)
          ? selected.filter((s) => s !== slug)
          : [...selected, slug],
      ),
    [apply, selected],
  )

  return {
    /** Selected slugs, in the order they were chosen. Empty means everything. */
    selected,
    toggle,
    clear: React.useCallback(() => apply([]), [apply]),
    isSelected: React.useCallback(
      (slug: string) => selected.includes(slug),
      [selected],
    ),
    /** Whether a record in this context should be shown. */
    matches: React.useCallback(
      (contextId: string) => covered.size === 0 || covered.has(contextId),
      [covered],
    ),
  }
}
