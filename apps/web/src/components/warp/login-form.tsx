"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { KeyRoundIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

type State = "idle" | "submitting" | "error"

/**
 * Warp is a single-user system, so this is a lock on one person's door — not the front
 * of a product. No sign-up, no social login, no reset link emailed to whoever holds the
 * address: each of those is a second way in to other people's correspondence.
 *
 * Borderless by design — the split panel is the frame, and a card inside it would be a
 * second box around the same content.
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
    <div className="w-full max-w-sm space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          One account, one owner. There is nothing to register.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
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
          className="w-full"
          disabled={state === "submitting"}
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

      <Separator />

      <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          No sign-up, no social login, no emailed reset link. A lost passphrase is
          recovered from the server, by the owner, on the box.
        </p>
        <p className="pl-5.5">
          Warp holds other people&apos;s correspondence. Signing in sends nothing —
          outbound actions still pass through the review queue.
        </p>
      </div>
    </div>
  )
}
