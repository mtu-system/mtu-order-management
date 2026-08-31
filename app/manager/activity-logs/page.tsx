import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { Clock } from 'lucide-react'
import ActivityLogsFeed from '@/app/manager/components/activity-logs-feed'

export default async function ManagerActivityLogsPage() {
  const user = await requireRole(['manager'])

  const supabase = await createClient()

  const [{ data: orderHistoryRaw }, { data: unitHistoryRaw }] =
    await Promise.all([
      supabase
        .from('order_history')
        .select(`
          id,
          action,
          new_value,
          reason,
          changed_at,
          orders ( customer, pk_number )
        `)
        .order('changed_at', { ascending: false })
        .limit(150),
      supabase
        .from('unit_history')
        .select(`
          id,
          action,
          new_value,
          reason,
          changed_at,
          orders ( customer, pk_number )
        `)
        .order('changed_at', { ascending: false })
        .limit(150),
    ])

  const combined = [
    ...(orderHistoryRaw || []).map((item: any) => ({
      id: item.id,
      action: item.action,
      new_value: item.new_value,
      reason: item.reason,
      changed_at: item.changed_at,
      customer: item.orders?.customer || '-',
      pkNumber: item.orders?.pk_number || null,
    })),
    ...(unitHistoryRaw || []).map((item: any) => ({
      id: item.id,
      action: item.action,
      new_value: item.new_value,
      reason: item.reason,
      changed_at: item.changed_at,
      customer: item.orders?.customer || '-',
      pkNumber: item.orders?.pk_number || null,
    })),
  ].sort(
    (a, b) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  )

  return (
    <DashboardShell user={user}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Activity Logs</h1>
        <p className="text-xs text-gray-500">
          Riwayat perubahan order & unit terbaru dari Marketing, Operational,
          dan HSE.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <Clock className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-900">
            Aktivitas Terbaru
          </h2>
        </div>

        <ActivityLogsFeed items={combined} />
      </div>
    </DashboardShell>
  )
}