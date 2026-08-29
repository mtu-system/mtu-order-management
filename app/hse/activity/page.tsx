import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import RecentActivityFeed from '@/app/components/recent-activity-feed'

export default async function HSEActivityPage() {
  const user = await requireRole(['hse'])

  return (
    <DashboardShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aktivitas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Semua kejadian penting dari semua order — unit Failed, dibatalkan,
          dialihkan ke Vendor, dan perubahan request.
        </p>
      </div>

      <RecentActivityFeed role="hse" limit={30} showHeader={false} />
    </DashboardShell>
  )
}