import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import RecentActivityFeed from '@/app/components/recent-activity-feed'

export default async function MarketingActivityPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Aktivitas"
        subtitle="Semua kejadian penting dari semua order — unit Failed, dibatalkan, dialihkan ke Vendor, dan perubahan request."
      />

      <RecentActivityFeed role="marketing" limit={30} showHeader={false} />
    </DashboardShell>
  )
}