import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import LiveMap from '@/app/components/live-map'

export const dynamic = 'force-dynamic'

export default async function OperationalLiveMapPage() {
  const user = await requireRole(['operational'])
  const supabase = await createClient()
  const rows = await loadMonitoringRows(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Live Map"
        subtitle="Posisi semua unit aktif, diperbarui otomatis."
      />
      <LiveMap rows={rows} />
    </DashboardShell>
  )
}