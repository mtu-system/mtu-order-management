import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import RecentActivityFeed from '@/app/components/recent-activity-feed'

export default async function MarketingActivityPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Aktivitas</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Semua kejadian penting dari semua order — unit Failed, dibatalkan,
          dialihkan ke Vendor, dan perubahan request.
        </p>
      </div>

      <RecentActivityFeed role="marketing" limit={30} showHeader={false} />
    </DashboardShell>
  )
}