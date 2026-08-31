import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/warp/app-header"
import { AppSidebar } from "@/components/warp/app-sidebar"
import { ContextsProvider } from "@/components/warp/contexts-provider"
import { SessionProvider } from "@/components/warp/session-provider"
import { requireSession } from "@/lib/api/session"

/**
 * Everything under here requires a session. The check runs on the server before any of
 * it renders, so an unauthenticated request never receives the markup — which a client
 * redirect cannot promise.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await requireSession()

  return (
    <SessionProvider>
      <ContextsProvider>
      <SidebarProvider>
        <AppSidebar email={account?.user.email} />
        <SidebarInset className="min-w-0">
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      </ContextsProvider>
    </SessionProvider>
  )
}
