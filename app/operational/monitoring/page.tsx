import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
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
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Monitoring</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Pantau perjalanan unit dari Finished Loading sampai Complete, lengkap
          dengan posisi GPS.
        </p>
      </div>

      <MonitoringBoard rows={rows} canEdit />
    </DashboardShell>
  )
}