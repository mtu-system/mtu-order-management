import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import LiveMap from '@/app/components/live-map'

export const dynamic = 'force-dynamic'

export default async function MarketingLiveMapPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])
  const supabase = await createClient()

  const rows = await loadMonitoringRows(supabase, {
    createdBy: user.role === 'marketing' ? user.id : undefined,
  })

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Live Map"
        subtitle="Posisi unit untuk order kamu."
      />
      <LiveMap rows={rows} />
    </DashboardShell>
  )
}