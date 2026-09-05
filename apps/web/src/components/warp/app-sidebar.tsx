"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CommandMenu } from "@/components/warp/command-menu"
import { ContextChip } from "@/components/warp/context-chip"
import { useContexts } from "@/components/warp/contexts-provider"
import { useSession } from "@/components/warp/session-provider"
import { CONTEXT_PARAM, useContextFilter } from "@/lib/context-filter"
import { SignOutButton } from "@/components/warp/sign-out-button"
import { cn } from "@/lib/utils"
import { commitments, proposedActions, tasks } from "@/lib/mock/data"

/**
 * Every badge in this file states what it counts.
 *
 * An earlier version put three different quantities in the same right-hand slot —
 * actions awaiting review, open tasks, open commitments — rendered identically. A number
 * that looks authoritative and means something different on each row is worse than no
 * number: it is read at a glance and it is read wrong.
 */
const nav = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    count: () => proposedActions.filter((a) => a.status === "pending").length,
    counts: "drafted actions waiting for your review",
  },
  {
    href: "/work-items",
    label: "Work items",
    icon: ListChecksIcon,
    count: () =>
      tasks.filter((t) => t.status !== "done" && t.status !== "dropped").length,
    counts: "tasks still open",
  },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/audit-log", label: "Audit log", icon: ScrollTextIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const

export function AppSidebar({ email }: { email?: string }) {
  const pathname = usePathname()
  const { session, scope } = useSession()
  const { contexts } = useContexts()
  const filter = useContextFilter()

  // The context selection is the view, not a property of one screen. Carrying it
  // across navigation is the difference between a filter and a per-page setting —
  // without this, moving from Work items to Schedule silently shows everything again.
  const withFilter = (href: string) =>
    filter.selected.length === 0
      ? href
      : `${href}?${CONTEXT_PARAM}=${encodeURIComponent(filter.selected.join(","))}`

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        {/* The mark and the name. The tagline used to live here and was clipped to
            "…everything toge…" at this width — a line nobody could finish reading,
            on a surface opened every morning. */}
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-[11px] font-semibold text-primary-foreground"
          >
            W
          </span>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Warp
          </span>
        </div>
        <CommandMenu />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const count = "count" in item ? item.count() : 0
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                      render={
                        <Link href={withFilter(item.href)}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                    {count > 0 && "counts" in item ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <SidebarMenuBadge className="cursor-help">
                              {count}
                            </SidebarMenuBadge>
                          }
                        />
                        <TooltipContent side="right">
                          {count} {item.counts}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>
            Contexts
            {filter.selected.length > 0 ? (
              <button
                type="button"
                onClick={filter.clear}
                className="ml-auto font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                showing {filter.selected.length} · clear
              </button>
            ) : (
              <span className="ml-auto font-normal text-muted-foreground/70">
                {session ? `${scope.length} in session` : "no session"}
              </span>
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {contexts.map((context) => {
                const nested = context.parentId !== null
                const inScope = scope.includes(context.id)
                const owed = commitments.filter(
                  (c) => c.contextId === context.id && c.status === "open",
                ).length

                const picked = filter.isSelected(context.slug)

                return (
                  <SidebarMenuItem key={context.id}>
                    {/* A filter, not a link. These used to navigate to
                        /work-items?context=<slug>, which meant narrowing the view
                        from any other screen threw you off it, and only ever to one
                        context at a time. Toggling stays where you are, and several
                        can be on at once. */}
                    <SidebarMenuButton
                      isActive={picked}
                      aria-pressed={picked}
                      onClick={() => filter.toggle(context.slug)}
                      className={cn(
                        "h-7",
                        // A child sits inside its parent's rail rather than on a
                        // slightly different indent nobody can measure by eye.
                        nested && "ml-3 border-l border-sidebar-border pl-2.5",
                        !inScope && session && !picked && "opacity-55",
                      )}
                    >
                      <ContextChip
                        contextId={context.id}
                        preview={{ name: context.name, color: context.color }}
                        className="text-[13px]"
                      />
                    </SidebarMenuButton>

                    {/* Not a count. Whether agents may touch this context right now
                        is the rule the whole session model turns on, and this list
                        is where it belongs.

                        Only the contexts in scope are marked. Labelling the other
                        five "quiet" as well says the same thing five times and
                        buries the two rows that matter — the dimming above already
                        carries it, and the tooltip explains either state. */}
                    {session && inScope ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <SidebarMenuBadge className="cursor-help font-normal text-muted-foreground">
                              live
                            </SidebarMenuBadge>
                          }
                        />
                        <TooltipContent side="right" className="max-w-56">
                          In this session — agents may read and draft here. {owed} open
                          commitment{owed === 1 ? "" : "s"}.
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* One row, not three stacked grey lines. The timezone and the phase are on
            the sign-in screen and in settings; repeating them here every day buys
            nothing. */}
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
            >
              {(email ?? "?").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {email ?? "not signed in"}
            </span>
            <SignOutButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
