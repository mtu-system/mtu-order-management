import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
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
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Control Tower</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Pantau semua unit secara realtime: kecepatan, status, sisa jarak, dan
          peringatan mengemudi.
        </p>
      </div>
      <ControlTower rows={rows} canEdit />
    </DashboardShell>
  )
}