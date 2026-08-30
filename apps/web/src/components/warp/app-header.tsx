"use client"

import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SessionBar } from "@/components/warp/session-bar"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/work-items": "Work items",
  "/schedule": "Schedule",
  "/audit-log": "Audit log",
  "/reports": "Reports",
  "/settings": "Settings",
  "/settings/connections": "Connections",
  "/settings/autonomy": "Autonomy",
}

export function AppHeader() {
  const pathname = usePathname()
  const title = titles[pathname] ?? "Warp"

  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <SessionBar />
    </header>
  )
}
