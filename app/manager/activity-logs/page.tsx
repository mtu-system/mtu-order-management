import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import ActivityLogSection from '@/app/components/activity-log-section'

export default async function ManagerActivityLogsPage() {
  const user = await requireRole(['manager'])

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Activity Logs"
        subtitle="Riwayat perubahan order & unit terbaru dari Marketing, Operational, dan HSE."
      />

      <ActivityLogSection role="manager" />
    </DashboardShell>
  )
}
