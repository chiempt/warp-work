"use client"

import * as React from "react"
import {
  BanIcon,
  KeyRoundIcon,
  LockIcon,
  PencilLineIcon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ContextChip } from "@/components/warp/context-chip"
import {
  CalendarMark,
  DriveMark,
  GmailMark,
  InstagramMark,
  MessengerMark,
  ZaloOaMark,
} from "@/components/warp/source-marks"
import { ReliabilityBadge } from "@/components/warp/reliability"
import { cn } from "@/lib/utils"
import { formatRelative, formatStamp } from "@/lib/format"
import { accounts, NOW } from "@/lib/mock/data"
import type { Account, AccountProvider } from "@/lib/mock/types"

type Availability = "connected" | "available" | "phase_4"

interface Connector {
  provider: AccountProvider
  name: string
  /** What the vendor actually offers — copied from context doc §4, not softened. */
  apiStatus: string
  /**
   * The vendor's own mark, not a generic glyph. This is the one screen where a logo is
   * the right call: the owner is picking a real account at a real company, and a mail
   * envelope does not distinguish Gmail from anything else.
   */
  services: { icon: () => React.ReactElement; label: string; detail: string }[]
  scopes: string[]
  availability: Availability
  note: string
  credentialFields: { id: string; label: string; placeholder: string; secret?: boolean }[]
}

const connectors: Connector[] = [
  {
    provider: "gmail",
    name: "Google account",
    apiStatus: "Full official API for Gmail, Calendar, and Drive under one OAuth grant.",
    services: [
      { icon: GmailMark, label: "Gmail", detail: "email signals, delta sync by history id" },
      { icon: CalendarMark, label: "Calendar", detail: "events, incremental sync tokens" },
      { icon: DriveMark, label: "Drive", detail: "file signals, change feed" },
    ],
    scopes: [
      "gmail.readonly",
      "gmail.send",
      "calendar.events",
      "drive.readonly",
    ],
    availability: "connected",
    note: "Warp only ever fetches deltas. A full mailbox re-fetch is a defect, not a fallback.",
    credentialFields: [],
  },
  {
    provider: "zalo_oa",
    name: "Zalo Official Account",
    apiStatus: "Official API — business Official Accounts only. There is no personal Zalo API.",
    services: [
      {
        icon: ZaloOaMark,
        label: "Zalo OA",
        detail: "message signals for an Official Account you administer",
      },
    ],
    scopes: ["oa.message.read", "oa.message.send", "oa.follower.read"],
    availability: "phase_4",
    note: "Scheduled for phase 4. Nothing connects until ingestion, extraction, and drafting have run against real traffic for several weeks.",
    credentialFields: [
      { id: "oa_id", label: "Official Account ID", placeholder: "1234567890123456789" },
      { id: "app_id", label: "App ID", placeholder: "From the Zalo developer console" },
      { id: "app_secret", label: "App secret", placeholder: "••••••••••••", secret: true },
    ],
  },
  {
    provider: "facebook_page",
    name: "Facebook Page",
    apiStatus:
      "Official Graph API — Pages and Page inboxes only. Personal messages have no API at all.",
    services: [
      {
        icon: MessengerMark,
        label: "Page inbox",
        detail: "Messenger conversations addressed to a Page you administer",
      },
    ],
    scopes: ["pages_show_list", "pages_messaging", "pages_read_engagement"],
    availability: "available",
    note: "Optional. Only worth connecting if a context actually receives work through a Page.",
    credentialFields: [
      { id: "page_id", label: "Page ID", placeholder: "1029384756" },
      { id: "app_token", label: "Page access token", placeholder: "••••••••••••", secret: true },
    ],
  },
  {
    provider: "instagram_business",
    name: "Instagram Business",
    apiStatus: "Official Graph API — Business and Creator accounts only.",
    services: [
      {
        icon: InstagramMark,
        label: "Direct messages",
        detail: "messages to a Business account linked to a Page",
      },
    ],
    scopes: ["instagram_basic", "instagram_manage_messages"],
    availability: "available",
    note: "Optional, and only alongside a connected Page — Instagram Business auth rides on the Page grant.",
    credentialFields: [
      { id: "ig_id", label: "Instagram Business ID", placeholder: "17841400000000000" },
    ],
  },
]

/** Permanently out of scope. Listed so the question is answered once and not re-asked. */
const refused = [
  {
    name: "Zalo personal",
    reason:
      "No official API. Every route in is an unofficial client, and using one risks the account being banned — which would cost more than the integration is worth.",
  },
  {
    name: "Facebook personal messages",
    reason: "Meta publishes no API for a personal inbox. This is not a matter of effort.",
  },
  {
    name: "Instagram personal",
    reason: "No API outside Business and Creator accounts.",
  },
]

export function ConnectionsView() {
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every context has to remain usable on manual sources alone. A connector that dies
        degrades Warp — it never breaks it — and anything derived from a failing source is
        marked as incomplete wherever it appears.
      </p>

      {connectors.map((connector) => (
        <ConnectorCard key={connector.provider} connector={connector} />
      ))}

      <ManualCard />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BanIcon className="size-4" /> Permanently out of scope
          </CardTitle>
          <CardDescription>
            These are closed questions, not a backlog. Warp will not ship a scraper, a
            browser automation, or an unofficial client for any of them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {refused.map((item) => (
              <li key={item.name} className="flex items-start gap-3">
                <LockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Work arriving through any of these reaches Warp by forwarding it to the manual
            address, which is a supported path and carries the{" "}
            <span className="text-foreground">manual</span> reliability tier.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ConnectorCard({ connector }: { connector: Connector }) {
  const linked = accounts.filter((a) => providerFamily(a.provider) === connector.provider)
  const active = linked.filter((a) => a.status !== "disabled")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {connector.name}
          <ReliabilityBadge reliability="official" />
          {connector.availability === "phase_4" ? (
            <Badge variant="outline" className="font-normal">
              phase 4
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{connector.apiStatus}</CardDescription>
        <CardAction>
          <ConnectButton connector={connector} connected={active.length > 0} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-3">
          {connector.services.map((service) => (
            <li
              key={service.label}
              className="flex items-start gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span className="mt-0.5 size-4 shrink-0">
                <service.icon />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{service.label}</p>
                <p className="text-xs text-muted-foreground">{service.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {active.length > 0 ? (
          <div className="divide-y divide-border rounded-lg border border-border">
            {active.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">Scopes requested:</span>{" "}
          <span className="font-mono">{connector.scopes.join(", ")}</span>. Credentials are
          encrypted at rest, never returned by the API, and never placed in a prompt.
        </p>
        <p className="text-xs text-muted-foreground">{connector.note}</p>
      </CardContent>
    </Card>
  )
}

function AccountRow({ account }: { account: Account }) {
  const failing = account.status === "needs_reauth" || account.status === "error"

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{account.displayName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {account.contextIds.map((id) => (
            <ContextChip key={id} contextId={id} />
          ))}
        </div>
      </div>

      <div className="text-right">
        <Badge
          variant={failing ? "destructive" : "outline"}
          className="font-normal"
        >
          {account.status.replace(/_/g, " ")}
        </Badge>
        <p className="mt-1 text-xs text-muted-foreground">
          {account.lastSyncAt
            ? `synced ${formatRelative(account.lastSyncAt, NOW)}`
            : "never synced"}
        </p>
      </div>

      {failing ? (
        <Button size="sm" variant="outline">
          <RefreshCwIcon /> Re-authorise
        </Button>
      ) : null}

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Disconnect">
              <UnplugIcon />
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {account.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Signals already ingested stay — they are immutable and everything derived
              from them keeps working. New traffic stops arriving, and{" "}
              {account.contextIds.length} context
              {account.contextIds.length === 1 ? "" : "s"} fall back to manual entry until
              you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {failing && account.lastError ? (
        <p className="w-full font-mono text-xs text-destructive">
          {account.lastError} · stopped at {formatStamp(account.lastSyncAt ?? NOW)}
        </p>
      ) : null}
    </div>
  )
}

function ConnectButton({
  connector,
  connected,
}: {
  connector: Connector
  connected: boolean
}) {
  if (connector.availability === "phase_4") {
    return (
      <Button size="sm" variant="outline" disabled>
        <LockIcon /> Available in phase 4
      </Button>
    )
  }

  const label = connected ? `Add another ${connector.name}` : `Connect ${connector.name}`

  // Google is a redirect-based OAuth grant; the others take credentials the owner pastes
  // from a developer console. Both paths end at the same place — an `accounts` row.
  if (connector.credentialFields.length === 0) {
    return (
      <Button size="sm" variant={connected ? "outline" : "default"}>
        <KeyRoundIcon /> {label}
      </Button>
    )
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant={connected ? "outline" : "default"}>
            <KeyRoundIcon /> {label}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {connector.name}</DialogTitle>
          <DialogDescription>{connector.apiStatus}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {connector.credentialFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                type={field.secret ? "password" : "text"}
                placeholder={field.placeholder}
                autoComplete="off"
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Stored encrypted in <span className="font-mono">accounts.credentials_enc</span>.
          Warp never shows a stored secret back to you, and never sends one to a model.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <DialogClose render={<Button>Connect</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManualCard() {
  const manual = accounts.find((a) => a.provider === "manual")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Manual entry and forwarding
          <ReliabilityBadge reliability="manual" />
        </CardTitle>
        <CardDescription>
          Always available, cannot be disconnected. This is the floor every context stands
          on when a connector fails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2.5">
          <PencilLineIcon className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm">inbox@warp.local</span>
          <span className="text-xs text-muted-foreground">
            forward anything here and it lands as a signal
          </span>
          <Badge variant="outline" className="ml-auto font-normal">
            {manual?.contextIds.length ?? 0} contexts
          </Badge>
        </div>
        <Separator />
        <p className={cn("text-xs text-muted-foreground")}>
          Signals from this source are tagged <span className="text-foreground">manual</span>,
          and every report generated from them says so.
        </p>
      </CardContent>
    </Card>
  )
}

/** Gmail, Calendar, and Drive are one grant to the owner, three providers in the schema. */
function providerFamily(provider: AccountProvider): AccountProvider {
  return provider === "gcalendar" || provider === "gdrive" ? "gmail" : provider
}
