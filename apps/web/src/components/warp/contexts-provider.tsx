"use client"

import * as React from "react"

import { contexts as seedContexts } from "@/lib/mock/data"
import type { Context } from "@/lib/mock/types"

interface ContextsState {
  contexts: Context[]
  save: (context: Context) => void
  archive: (id: string) => void
}

const ContextsContext = React.createContext<ContextsState | null>(null)

/**
 * The context list, held in one place.
 *
 * Contexts are the axis the whole product is organised around, so a copy of the list
 * inside the settings page would be the same mistake the session made before it was
 * lifted: create a context there and the sidebar keeps insisting it does not exist.
 *
 * UI-only: this is seeded from the fixtures and lives in memory. It becomes the
 * `contexts` resource once the API grows one — `listContexts` is in the contract, a
 * create operation is not yet.
 */
export function ContextsProvider({ children }: { children: React.ReactNode }) {
  const [contexts, setContexts] = React.useState<Context[]>(seedContexts)
  const created = React.useRef(0)

  const value = React.useMemo<ContextsState>(
    () => ({
      contexts,
      save: (context) =>
        setContexts((current) =>
          context.id === ""
            ? [...current, { ...context, id: `ctx-new-${++created.current}` }]
            : current.map((item) => (item.id === context.id ? context : item)),
        ),
      // Archiving, not deleting: signals, tasks and commitments point at a context,
      // and history does not stop being true because a life area ended.
      archive: (id) => setContexts((current) => current.filter((c) => c.id !== id)),
    }),
    [contexts],
  )

  return <ContextsContext value={value}>{children}</ContextsContext>
}

export function useContexts(): ContextsState {
  const value = React.useContext(ContextsContext)
  if (value === null) {
    throw new Error("useContexts must be used inside <ContextsProvider>")
  }
  return value
}

/** Slug the schema will accept: `contexts_slug_format` is `^[a-z0-9][a-z0-9_-]*$`. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
