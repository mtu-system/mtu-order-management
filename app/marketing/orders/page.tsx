import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import { History as HistoryIcon, PlusCircle } from 'lucide-react'

export default async function MarketingOrdersPage() {
  const user = await requireRole(['marketing'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      rft_tr_job,
      pk_number,
      vehicle_type,
      quantity,
      trip,
      status,
      created_at,
      reduce_unit_requested,
      reduce_unit_quantity,
      reduce_unit_vehicle_type,
      order_trucks (
        id,
        vehicle_type,
        source,
        status
      )
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch orders:', error)
  }

  const activeOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return false
    if (order.status === 'pending') return false
    if (order.status === 'ready_to_depart') return false

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      if (internalTrucks.length === 0) return false
    }

    return true
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

  const statusStyle = (status: string | null) => {
    switch (status) {
      case 'waiting_unit':
        return 'bg-amber-100 text-amber-800'
      case 'waiting_hse':
      case 'inspection':
        return 'bg-blue-100 text-blue-800'
      case 'ready_loading':
        return 'bg-emerald-100 text-emerald-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Order aktif yang dibuat oleh Marketing.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/marketing/orders/history"
            className="inline-flex items-center gap-2 rounded-lg border border-[#01236A]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#01236A] shadow-sm transition hover:bg-[#01236A]/5"
          >
            <HistoryIcon className="h-4 w-4" />
            Order History
          </Link>

          <Link
            href="/marketing/orders/create"
            className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#01236A]/85"
          >
            <PlusCircle className="h-4 w-4" />
            Create Order
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  PK / RFT
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kendaraan
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Progress
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Quantity
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Trip
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {!activeOrders.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-14 text-center text-sm text-gray-400"
                  >
                    Tidak ada order aktif.
                  </td>
                </tr>
              ) : (
                activeOrders.map((order) => {
                  const activeTrucks =
                    order.order_trucks?.filter(
                      (truck) =>
                        truck.status !== 'cancelled' &&
                        truck.status !== 'departed' &&
                        truck.status !== 'finished' &&
                        truck.status !== 'failed'
                    ) || []

                  const vehicleSummary = activeTrucks.reduce(
                    (result: Record<string, number>, truck) => {
                      result[truck.vehicle_type] =
                        (result[truck.vehicle_type] || 0) + 1
                      return result
                    },
                    {}
                  )

                  const vehicleText = Object.entries(vehicleSummary)
                    .map(
                      ([vehicleType, quantity]) =>
                        `${vehicleType} (${quantity})`
                    )
                    .join(', ')

                  const activeQuantity = activeTrucks.length

                  const internalTrucks = activeTrucks.filter(
                    (truck) => truck.source === 'internal'
                  )

                  const readyToDepartCount = internalTrucks.filter(
                    (truck) => truck.status === 'ready_to_depart'
                  ).length

                  const readyLoadingCount = internalTrucks.filter(
                    (truck) => truck.status === 'ready_loading'
                  ).length

                  const waitingHseCount = internalTrucks.filter(
                    (truck) =>
                      truck.status === 'waiting_hse' ||
                      truck.status === 'inspection'
                  ).length

                  const vmCount = activeTrucks.filter(
                    (truck) => truck.source === 'vendor'
                  ).length

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
                        <div className="text-gray-900">
                          {order.pk_number || '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.rft_tr_job || '-'}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {vehicleText || '-'}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {internalTrucks.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              {readyToDepartCount}/{internalTrucks.length}{' '}
                              Ready to Depart
                            </span>
                          )}

                          {readyLoadingCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              {readyLoadingCount} Menunggu SJ/UJ
                            </span>
                          )}

                          {waitingHseCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              {waitingHseCount} Waiting HSE
                            </span>
                          )}

                          {vmCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                              VM {vmCount}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {activeQuantity} Unit
                        </div>

                        {order.reduce_unit_requested && (
                          <div className="mt-1">
                            <div className="text-xs font-semibold text-orange-600">
                              -{order.reduce_unit_quantity} Unit{' '}
                              {order.reduce_unit_vehicle_type}
                            </div>
                            <div className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                              Menunggu Operational
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="max-w-xs px-6 py-4">
                        <p className="truncate text-gray-600">
                          {order.trip || '-'}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusStyle(
                            order.status
                          )}`}
                        >
                          {order.status
  ?.replaceAll('_', ' ')
  .replace(/\b\w/g, (char: string) => char.toUpperCase()) ||
  'Unknown'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/marketing/orders/${order.id}`}
                          className="text-sm font-semibold text-[#01236A] hover:underline"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  )
}