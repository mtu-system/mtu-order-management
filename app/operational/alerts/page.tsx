import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import AlertsTable from '@/app/components/alerts-table'

export const dynamic = 'force-dynamic'

export default async function OperationalAlertsPage() {
  const user = await requireRole(['operational'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('unit_alerts')
    .select(
      'id, plate, customer, trip, kind, level, message, started_at, resolved_at, acknowledged_at'
    )
    .order('started_at', { ascending: false })
    .limit(300)

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Peringatan</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Peringatan otomatis dari pemantauan GPS: durasi mengemudi, berhenti di
          luar area, dan GPS tidak aktif.
        </p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AlertsTable initialAlerts={(data || []) as any} canAck />
    </DashboardShell>
  )
}