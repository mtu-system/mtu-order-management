import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
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
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Monitoring</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Posisi dan status perjalanan seluruh unit — read only.
        </p>
      </div>

      <MonitoringBoard rows={rows} canEdit={false} />
    </DashboardShell>
  )
}