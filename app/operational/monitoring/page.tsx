import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import MonitoringBoard from '@/app/components/monitoring-board'

export const dynamic = 'force-dynamic'

export default async function OperationalMonitoringPage() {
  const user = await requireRole(['operational'])
  const supabase = await createClient()
  const rows = await loadMonitoringRows(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Monitoring"
        subtitle="Pantau perjalanan unit dari Finished Loading sampai Complete, lengkap dengan posisi GPS."
      />

      <MonitoringBoard rows={rows} canEdit />
    </DashboardShell>
  )
}