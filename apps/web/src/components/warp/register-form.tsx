"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon, LoaderCircleIcon, UserPlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton, OrDivider } from "@/components/warp/google-button"
import { api } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { OWNER_TIME_ZONE } from "@/lib/format"

const MIN_PASSPHRASE = 12

type Field = "name" | "email" | "passphrase" | "confirm"

/**
 * Creating the account.
 *
 * Warp has one user, so this runs once: it provisions the owner row that every
 * `user_id` column in the schema points at. The API closes this route as soon as that row
 * exists — a single-user system with an open registration endpoint is a multi-user system
 * nobody meant to build.
 *
 * The Google path creates the same account and stores the grant, which is why it sits
 * first: the owner is going to connect Gmail and Calendar anyway, and doing it here saves
 * the step.
 */
export function RegisterForm() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [values, setValues] = React.useState<Record<Field, string>>({
    name: "",
    email: "",
    passphrase: "",
    confirm: "",
  })
  const [touched, setTouched] = React.useState(false)

  const set = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }))

  const tooShort =
    values.passphrase.length > 0 && values.passphrase.length < MIN_PASSPHRASE
  const mismatch = values.confirm.length > 0 && values.confirm !== values.passphrase
  const complete =
    values.name.trim() !== "" &&
    values.email.trim() !== "" &&
    values.passphrase.length >= MIN_PASSPHRASE &&
    values.confirm === values.passphrase

  const [failure, setFailure] = React.useState<string | null>(null)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (!complete) return

    setPending(true)
    setFailure(null)

    const { response, error } = await api.POST("/api/v1/auth/register", {
      body: {
        email: values.email.trim(),
        password: values.passphrase,
        displayName: values.name.trim(),
      },
    })

    // Registration signs the new owner straight in — the API opens the session in the
    // same transaction that creates them, so there is no window where the account
    // exists and cannot be used.
    if (response.ok) {
      router.replace("/")
      router.refresh()
      return
    }

    setPending(false)
    setFailure(messageFor(response.status, error))
  }

  return (
    <div className="w-full max-w-[22rem] space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          This is the owner account — the one Warp is for. It is created once.
        </p>
      </header>

      <div className="space-y-3">
        <GoogleButton label="Sign up with Google" onStart={() => setPending(true)} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Creates the account and keeps the grant, so Gmail, Calendar and Drive are
          connected from the start.
        </p>
      </div>

      <OrDivider>or set a passphrase</OrDivider>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Chiêm"
            className="h-10"
            value={values.name}
            onChange={set("name")}
            aria-invalid={touched && values.name.trim() === ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            className="h-10"
            value={values.email}
            onChange={set("email")}
            aria-invalid={touched && values.email.trim() === ""}
          />
          <p className="text-xs text-muted-foreground">
            Used to sign in. It does not have to be an address Warp ingests from.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passphrase">Passphrase</Label>
          <Input
            id="passphrase"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            className="h-10"
            value={values.passphrase}
            onChange={set("passphrase")}
            aria-invalid={tooShort || (touched && values.passphrase === "")}
          />
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs",
              values.passphrase.length >= MIN_PASSPHRASE
                ? "text-muted-foreground"
                : tooShort
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {values.passphrase.length >= MIN_PASSPHRASE ? (
              <CheckIcon className="size-3.5" />
            ) : null}
            At least {MIN_PASSPHRASE} characters. There is no reset link — a lost
            passphrase is recovered on the server, by you.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm passphrase</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            className="h-10"
            value={values.confirm}
            onChange={set("confirm")}
            aria-invalid={mismatch}
          />
          {mismatch ? (
            <p role="alert" className="text-xs text-destructive">
              The two passphrases do not match.
            </p>
          ) : null}
        </div>

        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={pending || (touched && !complete)}
        >
          {pending ? (
            <>
              <LoaderCircleIcon className="animate-spin" /> Creating…
            </>
          ) : (
            <>
              <UserPlusIcon /> Create account
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
        <p>
          Times are shown in {OWNER_TIME_ZONE}. Everything is stored in UTC; this is only
          how it is displayed.
        </p>
        <p>
          Account already exists?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

/**
 * 409 is the one worth naming. Warp has a single owner, and the API closes this route
 * once that row exists — so a conflict here is not a retryable error, it means the
 * account already exists and the person wants the other screen.
 */
function messageFor(status: number, error: unknown): string {
  if (status === 409) {
    return "An owner account already exists on this server. Sign in instead."
  }
  if (status === 422) return "Check the details above and try again."
  if (status === 501) return "Registration is not available on this server yet."

  const envelope = error as { error?: { message?: string } } | undefined
  return envelope?.error?.message ?? "Could not create the account. The API did not answer."
}
