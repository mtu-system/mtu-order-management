import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import MonitoringBoard from '@/app/components/monitoring-board'

export const dynamic = 'force-dynamic'

export default async function ManagerMonitoringPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()
  const rows = await loadMonitoringRows(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Monitoring"
        subtitle="Posisi dan status perjalanan seluruh unit — read only."
      />

      <MonitoringBoard rows={rows} canEdit={false} />
    </DashboardShell>
  )
}