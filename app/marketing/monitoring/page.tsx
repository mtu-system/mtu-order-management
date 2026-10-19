import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
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
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Monitoring</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Posisi dan status perjalanan unit untuk order kamu.
        </p>
      </div>

      <MonitoringBoard rows={rows} canEdit={false} />
    </DashboardShell>
  )
}