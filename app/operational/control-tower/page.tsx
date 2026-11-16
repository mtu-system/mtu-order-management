import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import ControlTower from '@/app/components/control-tower'

export const dynamic = 'force-dynamic'

export default async function OperationalControlTowerPage() {
  const user = await requireRole(['operational'])
  const supabase = await createClient()
  const rows = await loadMonitoringRows(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Control Tower"
        subtitle="Pantau semua unit secara realtime: kecepatan, status, sisa jarak, dan peringatan mengemudi."
      />
      <ControlTower rows={rows} canEdit />
    </DashboardShell>
  )
}