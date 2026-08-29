import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, Inbox } from 'lucide-react'
import RecentActivityFeed from '@/app/components/recent-activity-feed'

export default async function HSEPage() {
  const user = await requireRole(['hse'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      quantity,
      trip,
      status,
      created_at,
      order_requirements (
        id,
        vehicle_type,
        quantity
      ),
      order_trucks (
        id,
        vehicle_type,
        no_buntut,
        source,
        status
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('HSE ORDERS ERROR:', error)
  }

  const hseOrders = (orders || []).filter((order) => {
    const trucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal'
    )

    return trucks.some(
      (truck) =>
        truck.status === 'waiting_hse' || truck.status === 'inspection'
    )
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

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">HSE Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Daftar order yang masih memiliki unit yang menunggu pemeriksaan
          HSE.
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
                  Kendaraan
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Trip
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {hseOrders.map((order) => {
                const trucks = order.order_trucks || []

                const activeTrucks = trucks.filter(
                  (truck) =>
                    truck.status !== 'cancelled' &&
                    truck.source === 'internal'
                )

                const total = activeTrucks.length

                const passed = activeTrucks.filter(
                  (truck) => truck.status === 'ready_loading'
                ).length

                const failed = activeTrucks.filter(
                  (truck) => truck.status === 'failed'
                ).length

                const waiting = activeTrucks.filter(
                  (truck) =>
                    truck.status === 'waiting_hse' ||
                    truck.status === 'inspection'
                ).length

                const vehicleCounts: Record<string, number> = {}

                for (const truck of activeTrucks) {
                  const vehicleType = truck.vehicle_type || 'Unknown'
                  vehicleCounts[vehicleType] =
                    (vehicleCounts[vehicleType] || 0) + 1
                }

                const vehicleSummary = Object.entries(vehicleCounts)
                  .map(([vehicleType, count]) => `${vehicleType} (${count})`)
                  .join(', ')

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
                      {vehicleSummary || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {passed} / {total} Passed
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {waiting} Waiting
                        {failed > 0 && <>{' · '}{failed} Failed</>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{order.trip}</td>
                    <td className="px-6 py-4">
                      {waiting > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          Waiting HSE
                        </span>
                      )}
                      {waiting === 0 && failed > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          Ada Unit Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/hse/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
                      >
                        Detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!hseOrders.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">
                Tidak ada unit yang menunggu pemeriksaan HSE.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}