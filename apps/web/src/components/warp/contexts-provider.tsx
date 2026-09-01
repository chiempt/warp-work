"use client"

import * as React from "react"

import { api } from "@/lib/api/client"
import { contexts as seedContexts } from "@/lib/mock/data"
import type { Context, ContextKind } from "@/lib/mock/types"
import type { components } from "@/lib/api/schema"

type ApiContext = components["schemas"]["Context"]

export type CreateResult = { ok: true } | { ok: false; message: string }

interface ContextsState {
  contexts: Context[]
  /** Creates on the server, then adopts the row it returns. */
  create: (context: Context) => Promise<CreateResult>
  /** Local only — the contract has no update operation yet. */
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

  const value = React.useMemo<ContextsState>(
    () => ({
      contexts,

      create: async (context) => {
        const { data, error, response } = await api.POST("/api/v1/contexts", {
          body: {
            slug: context.slug,
            name: context.name,
            kind: context.kind,
            parentId: context.parentId,
            toneProfile: context.toneProfile || undefined,
          },
        })

        if (!response.ok || !data) {
          return { ok: false, message: messageFor(response.status, error) }
        }

        // Adopt the server's row rather than the draft: the id, position and
        // normalised fields are the database's to decide, and holding a local
        // guess next to them is how the two drift.
        setContexts((current) => [...current, fromApi(data)])
        return { ok: true }
      },

      save: (context) =>
        setContexts((current) =>
          current.map((item) => (item.id === context.id ? context : item)),
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

/**
 * The API's shape onto the one the interface renders.
 *
 * `activeHours` has no counterpart in the contract's Context schema yet, and the column
 * defaults to `{}` — always active — so that is what a freshly created context shows,
 * rather than a value invented here.
 */
function fromApi(row: ApiContext): Context {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    slug: row.slug,
    name: row.name,
    kind: row.kind as ContextKind,
    toneProfile: row.toneProfile ?? "",
    activeHours: "Always",
  }
}

function messageFor(status: number, error: unknown): string {
  const envelope = error as { error?: { code?: string; message?: string } } | undefined

  if (status === 409) {
    return "That slug is already in use. Slugs are what routing rules refer to, so they are not reused."
  }
  if (status === 422) {
    return envelope?.error?.message ?? "Those values were refused."
  }
  if (status === 400) {
    return "The server rejected the values. Check the slug and the name."
  }
  if (status === 401) return "Your session has expired. Sign in again."
  if (status === 501) return "Creating a context is not available on this server yet."

  return envelope?.error?.message ?? "Could not create the context. The API did not answer."
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
