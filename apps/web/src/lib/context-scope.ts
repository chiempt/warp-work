import { contexts } from "@/lib/mock/data"

/** The search param carrying the selection, as a comma-separated list of slugs. */
export const CONTEXT_PARAM = "contexts"

const bySlug = new Map(contexts.map((context) => [context.slug, context]))

/**
 * Every context a selection covers, including the children of anything selected.
 *
 * Contexts nest and inherit (`Self > Sport`), so selecting a parent and then not seeing
 * its children would contradict the model the rest of the product is built on.
 *
 * Deliberately free of hooks and of `"use client"`, so the rule is the same one on both
 * sides: the sidebar toggles it in the browser, and a Server Component filtering its own
 * data reaches the same answer rather than a second implementation of it.
 */
export function coveredContexts(slugs: string[]): Set<string> {
  const ids = new Set<string>()

  const addWithChildren = (id: string) => {
    if (ids.has(id)) return
    ids.add(id)
    for (const child of contexts) {
      if (child.parentId === id) addWithChildren(child.id)
    }
  }

  for (const slug of slugs) {
    const context = bySlug.get(slug)
    if (context) addWithChildren(context.id)
  }
  return ids
}

/** Parses the raw search-param value. An empty selection means every context. */
export function parseContextParam(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (value ?? "").split(",").filter(Boolean)
}

/** A predicate over context ids. Empty selection matches everything. */
export function contextMatcher(slugs: string[]): (contextId: string) => boolean {
  const covered = coveredContexts(slugs)
  return (contextId) => covered.size === 0 || covered.has(contextId)
}
