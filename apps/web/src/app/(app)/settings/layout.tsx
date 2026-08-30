import { SettingsNav } from "@/components/warp/settings-nav"
import { PageHeader } from "@/components/warp/page-header"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Contexts, the sources that feed them, and how much Warp is trusted to do inside each one."
      />
      <SettingsNav />
      {children}
    </>
  )
}
