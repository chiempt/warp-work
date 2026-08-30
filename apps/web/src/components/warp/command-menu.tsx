"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PlugZapIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { ContextChip } from "@/components/warp/context-chip"
import { contexts } from "@/lib/mock/data"

const routes = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/work-items", label: "Work items", icon: ListChecksIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarDaysIcon },
  { href: "/audit-log", label: "Audit log", icon: ScrollTextIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/settings/connections", label: "Connections", icon: PlugZapIcon },
]

/**
 * Keyboard-first navigation. The owner works this app in long sittings; reaching for the
 * mouse to change context is the thing that breaks the sitting.
 */
export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        tooltip="Search — ⌘K"
        className="text-muted-foreground"
      >
        <SearchIcon />
        <span>Search</span>
        <CommandShortcut className="ml-auto group-data-[collapsible=icon]:hidden">
          ⌘K
        </CommandShortcut>
      </SidebarMenuButton>

      {/* `CommandDialog` supplies the dialog only — the cmdk context comes from
          `Command`, which has to wrap the input and the list. */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Go to a screen, or scope to a context…" />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Screens">
              {routes.map((route) => (
                <CommandItem
                  key={route.href}
                  value={route.label}
                  onSelect={() => go(route.href)}
                >
                  <route.icon />
                  {route.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Scope work items to a context">
              {contexts.map((context) => (
                <CommandItem
                  key={context.id}
                  value={`context ${context.name}`}
                  onSelect={() => go(`/work-items?context=${context.slug}`)}
                >
                  <ContextChip contextId={context.id} showParent className="text-sm" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
