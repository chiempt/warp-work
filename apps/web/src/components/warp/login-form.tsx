"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRoundIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton, OrDivider } from "@/components/warp/google-button"
import { api } from "@/lib/api/client"

type State = "idle" | "google" | "submitting" | "error"

/**
 * Warp is a single-user system, so this is a lock on one person's door.
 *
 * Two ways through it, and both land on the same account. Google is the primary path
 * because Warp already holds a Google grant for Gmail, Calendar and Drive — signing in
 * with that account reuses an identity the system depends on rather than adding a second
 * one, and the API pins it to the owner's `sub`, refusing every other Google account. The
 * passphrase is the fallback for when Google is down or the grant has lapsed.
 */
export function LoginForm() {
  const router = useRouter()
  const [state, setState] = React.useState<State>("idle")
  const [email, setEmail] = React.useState("")
  const [passphrase, setPassphrase] = React.useState("")

  const [failure, setFailure] = React.useState<string | null>(null)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email || !passphrase) {
      setState("error")
      setFailure("Enter both an email and a passphrase.")
      return
    }

    setState("submitting")
    setFailure(null)

    const { response, error } = await api.POST("/api/v1/auth/login", {
      body: { email, password: passphrase },
    })

    // The session cookie is set by the API on this response. It is HttpOnly, so
    // there is nothing to read here and nothing to store — the browser has it.
    if (response.ok) {
      // `replace` so the back button does not return to a form that has already
      // succeeded. `refresh` because the gate admitting us runs on the server: it
      // invalidates the router cache so the shell is fetched with the new cookie
      // rather than from an entry created while nobody was signed in.
      router.replace("/")
      router.refresh()
      return
    }

    setState("error")
    setFailure(messageFor(response.status, error))
  }

  return (
    <div className="w-full max-w-[22rem] space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          One account, one owner. Warp is for a single person.
        </p>
      </header>

      <div className="space-y-3">
        <GoogleButton onStart={() => setState("google")} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          The same Google account Warp reads mail and calendar from. Pinned to that one
          account — any other is refused.
        </p>
      </div>

      <OrDivider>or use a passphrase</OrDivider>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            className="h-10"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setState("idle")
            }}
            aria-invalid={state === "error" && !email}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passphrase">Passphrase</Label>
          <Input
            id="passphrase"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            className="h-10"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value)
              setState("idle")
            }}
            aria-invalid={state === "error" && !passphrase}
          />
        </div>

        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox defaultChecked />
          Keep this device signed in for 30 days
        </Label>

        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={state === "submitting" || state === "google"}
        >
          {state === "submitting" ? (
            <>
              <LoaderCircleIcon className="animate-spin" /> Signing in…
            </>
          ) : (
            <>
              <KeyRoundIcon /> Sign in
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          Warp holds other people&apos;s correspondence. Signing in sends nothing —
          outbound actions still pass through the review queue.
        </p>
        <p>
          First run on this server?{" "}
          <Link
            href="/register"
            className="text-foreground underline underline-offset-4"
          >
            Create the owner account
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

/**
 * The API answers a wrong password and an unregistered address identically, so this
 * does too. Reporting them differently would turn the form into a way to find out which
 * addresses exist.
 */
function messageFor(status: number, error: unknown): string {
  if (status === 401) return "Email or passphrase is incorrect."
  if (status === 429) return "Too many attempts. Try again in a few minutes."
  if (status === 501) return "Sign-in is not available on this server yet."

  const envelope = error as { error?: { message?: string } } | undefined
  return envelope?.error?.message ?? "Could not sign in. The API did not answer."
}
