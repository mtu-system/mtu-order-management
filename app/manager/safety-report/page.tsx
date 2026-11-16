import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import SafetyReportView from '@/app/components/safety-report-view'
import { buildReport, loadAlertRows } from '@/lib/safety-report'

export const dynamic = 'force-dynamic'

export default async function ManagerSafetyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { days: daysParam } = await searchParams
  const days = [7, 14, 30].includes(Number(daysParam)) ? Number(daysParam) : 7

  const rows = await loadAlertRows(
    supabase,
    new Date(Date.now() - 2 * days * 24 * 3600e3).toISOString()
  )
  const report = buildReport(rows, days)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Laporan Keselamatan"
        subtitle="Ringkasan pelanggaran keselamatan dari pemantauan GPS: overspeed, jalan malam, jam mengemudi, dan penanganannya."
      />
      <SafetyReportView report={report} />
    </DashboardShell>
  )
}