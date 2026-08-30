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

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email || !passphrase) {
      setState("error")
      return
    }
    // UI-only: the real form posts to the API and the API sets the session cookie.
    setState("submitting")
    router.push("/")
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
        <GoogleButton
          onStart={() => {
            setState("google")
            router.push("/")
          }}
        />
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

        {state === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            Enter both an email and a passphrase.
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
