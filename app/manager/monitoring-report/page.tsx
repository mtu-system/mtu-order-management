import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringReport } from '@/lib/monitoring-report'
import MonitoringReportView from '@/app/components/monitoring-report'

export const dynamic = 'force-dynamic'

export default async function ManagerMonitoringReportPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()
  const report = await loadMonitoringReport(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Update Customer"
        subtitle="Laporan Monitoring Update per RFT: download Excel lalu forward ke email customer. Jam terisi otomatis dari GPS dan bisa dikoreksi."
      />
      <MonitoringReportView report={report} editable />
    </DashboardShell>
  )
}
