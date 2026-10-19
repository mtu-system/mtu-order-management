import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { loadMonitoringRows } from '@/lib/monitoring'
import LiveMap from '@/app/components/live-map'

export const dynamic = 'force-dynamic'

export default async function MarketingLiveMapPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])
  const supabase = await createClient()

  const rows = await loadMonitoringRows(supabase, {
    createdBy: user.role === 'marketing' ? user.id : undefined,
  })

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Live Map</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Posisi unit untuk order kamu.
        </p>
      </div>
      <LiveMap rows={rows} />
    </DashboardShell>
  )
}