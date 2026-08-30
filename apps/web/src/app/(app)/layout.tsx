import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/warp/app-header"
import { AppSidebar } from "@/components/warp/app-sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 md:px-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
