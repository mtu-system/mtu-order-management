import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import MonitoringBoard from '@/app/components/monitoring-board'

export const dynamic = 'force-dynamic'

export default async function MarketingMonitoringPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])
  const supabase = await createClient()

  const rows = await loadMonitoringRows(supabase, {
    createdBy: user.role === 'marketing' ? user.id : undefined,
  })

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Monitoring"
        subtitle="Posisi dan status perjalanan unit untuk order kamu."
      />

      <MonitoringBoard rows={rows} canEdit={false} />
    </DashboardShell>
  )
}