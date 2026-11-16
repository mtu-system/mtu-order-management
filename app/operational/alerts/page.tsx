import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
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
      <PageHeader
        title="Peringatan"
        subtitle="Peringatan otomatis dari pemantauan GPS: durasi mengemudi, berhenti di luar area, dan GPS tidak aktif."
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <AlertsTable initialAlerts={(data || []) as any} canAck />
    </DashboardShell>
  )
}