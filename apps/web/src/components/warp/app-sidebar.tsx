"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  LogOutIcon,
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
} from "@/components/ui/sidebar"
import { ContextChip } from "@/components/warp/context-chip"
import { CommandMenu } from "@/components/warp/command-menu"
import { cn } from "@/lib/utils"
import { commitments, contexts, proposedActions, tasks } from "@/lib/mock/data"

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/work-items", label: "Work items", icon: ListChecksIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/audit-log", label: "Audit log", icon: ScrollTextIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const

const pendingReview = proposedActions.filter((a) => a.status === "pending").length

function badgeFor(href: string): number | null {
  if (href === "/") return pendingReview || null
  if (href === "/work-items") {
    return tasks.filter((t) => t.status !== "done" && t.status !== "dropped").length
  }
  return null
}

export function AppSidebar() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:px-0">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-[11px] font-semibold text-primary-foreground"
          >
            W
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">Warp</p>
            <p className="truncate text-xs text-muted-foreground">
              The frame that holds everything together
            </p>
          </div>
        </div>
        <CommandMenu />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const count = badgeFor(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                    {count ? <SidebarMenuBadge>{count}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Contexts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contexts.map((context) => {
                const owed = commitments.filter(
                  (c) => c.contextId === context.id && c.status === "open",
                ).length
                return (
                  <SidebarMenuItem key={context.id}>
                    <SidebarMenuButton
                      className="h-7"
                      render={
                        <Link
                          href={{
                            pathname: "/work-items",
                            query: { context: context.slug },
                          }}
                        >
                          <ContextChip
                            contextId={context.id}
                            className={cn(
                              "text-[13px]",
                              context.parentId && "pl-3",
                            )}
                          />
                        </Link>
                      }
                    />
                    {owed ? <SidebarMenuBadge>{owed}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <p className="truncate">chiem.pt@baohiemtasco.vn</p>
          <p className="truncate">Asia/Ho_Chi_Minh · phase 1</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="text-muted-foreground"
              render={
                <Link href="/login">
                  <LogOutIcon />
                  <span>Sign out</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
