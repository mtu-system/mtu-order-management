import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import FleetOverview from '@/app/components/fleet-overview'

export const dynamic = 'force-dynamic'

export default async function OperationalFleetPage() {
  const user = await requireRole(['operational'])

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Armada & Pool"
        subtitle="Sebaran unit per wilayah dan unit luar kota yang sedang pulang ke pool."
      />
      <FleetOverview />
    </DashboardShell>
  )
}
