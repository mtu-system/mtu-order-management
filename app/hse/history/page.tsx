import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { Inbox } from 'lucide-react'

export default async function HSEHistoryPage() {
  const user = await requireRole(['hse'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      trip,
      status,
      unit_decision,
      created_at,
      order_trucks (
        id,
        vehicle_type,
        source,
        status
      )
    `)
    .neq('status', 'waiting_unit')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET HSE HISTORY ERROR:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (!order.unit_decision) return false

    const internalTrucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal' && truck.status !== 'cancelled'
    )

    const stillWaiting = internalTrucks.some(
      (truck) =>
        truck.status === 'waiting_hse' || truck.status === 'inspection'
    )

    return !stillWaiting
  })

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ]

  const getAvatarClass = (name: string) => {
    const index =
      name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      avatarColors.length
    return avatarColors[index]
  }

  const getVehicleSummary = (order: (typeof historyOrders)[number]) => {
    const internalTrucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal' && truck.status !== 'cancelled'
    )

    if (internalTrucks.length === 0) {
      return 'Full VM (tidak ada unit Internal)'
    }

    const counts: Record<string, number> = {}
    for (const truck of internalTrucks) {
      counts[truck.vehicle_type] = (counts[truck.vehicle_type] || 0) + 1
    }

    return Object.entries(counts)
      .map(([type, count]) => `${type} (${count})`)
      .join(', ')
  }

  const getVmCount = (order: (typeof historyOrders)[number]) => {
    return (order.order_trucks || []).filter(
      (truck) => truck.source === 'vendor' && truck.status !== 'cancelled'
    ).length
  }

  const getResultBadge = (order: (typeof historyOrders)[number]) => {
    const internalTrucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal' && truck.status !== 'cancelled'
    )

    if (internalTrucks.length === 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
          Full VM — Tidak Perlu HSE
        </span>
      )
    }

    const failedCount = internalTrucks.filter(
      (truck) => truck.status === 'failed'
    ).length

    if (failedCount > 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          {failedCount} Unit Failed
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
        Semua Passed
      </span>
    )
  }

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Inspection History
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Order yang sudah tidak menunggu pemeriksaan HSE lagi — sudah
          selesai diperiksa, atau memang full-VM sehingga tidak pernah butuh
          pemeriksaan.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  PK / RFT
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kendaraan Internal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  VM
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Trip
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hasil
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {historyOrders.map((order) => {
                const vmCount = getVmCount(order)

                return (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarClass(
                            order.customer
                          )}`}
                        >
                          {order.customer.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">
                          {order.customer}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{order.pk_number}</div>
                      <div className="text-xs text-gray-400">
                        {order.rft_tr_job || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {getVehicleSummary(order)}
                    </td>
                    <td className="px-6 py-4">
                      {vmCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                          VM {vmCount}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{order.trip}</td>
                    <td className="px-6 py-4">{getResultBadge(order)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!historyOrders.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">Belum ada history HSE.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}