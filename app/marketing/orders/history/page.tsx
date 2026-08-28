import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'

export default async function MarketingOrderHistoryPage() {
  const user = await requireRole(['marketing'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      rft_tr_job,
      pk_number,
      quantity,
      trip,
      status,
      cancel_reason,
      cancelled_at,
      created_at,
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
    console.error('Failed to fetch order history:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return true
    if (order.status === 'pending') return true
    if (order.status === 'ready_to_depart') return true

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      return internalTrucks.length === 0
    }

    return false
  })

  const getStatusBadge = (order: (typeof historyOrders)[number]) => {
    if (order.status === 'cancelled') {
      return (
        <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          Cancelled
        </span>
      )
    }
    if (order.status === 'pending') {
      return (
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          Unit Tidak Tersedia
        </span>
      )
    }
    if (order.status === 'ready_to_depart') {
      return (
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          Ready to Depart
        </span>
      )
    }
    return (
      <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
        Full VM
      </span>
    )
  }

  const getVehicleBreakdown = (order: (typeof historyOrders)[number]) => {
    const trucks = (order.order_trucks || []).filter(
      (truck) => truck.status !== 'cancelled'
    )

    const internalCount = trucks.filter(
      (truck) => truck.source === 'internal'
    ).length

    const vmCount = trucks.filter(
      (truck) => truck.source === 'vendor'
    ).length

    return { internalCount, vmCount }
  }

  return (
    <DashboardShell user={user}>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order History
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Order yang sudah selesai, Ready to Depart, dibatalkan, atau
              Unit Tidak Tersedia.
            </p>
          </div>

          <Link
            href="/marketing/orders"
            className="text-sm font-semibold text-[#01236A] hover:underline"
          >
            ← Kembali ke Orders
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Customer
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  PK / RFT
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Quantity
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Kendaraan
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Trip
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-4 font-semibold text-gray-700">
                  Tanggal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {!historyOrders.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Belum ada history.
                  </td>
                </tr>
              ) : (
                historyOrders.map((order) => {
                  const { internalCount, vmCount } =
                    getVehicleBreakdown(order)

                  return (
                    <tr key={order.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {order.customer}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {order.pk_number || '-'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {order.rft_tr_job || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">{order.quantity} Unit</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {internalCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-2 py-0.5 text-[11px] font-bold text-[#01236A]">
                              Internal {internalCount}
                            </span>
                          )}
                          {vmCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                              VM {vmCount}
                            </span>
                          )}
                          {internalCount === 0 && vmCount === 0 && (
                            <span className="text-gray-300">-</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-6 py-4">
                        <p className="truncate">{order.trip || '-'}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(order)}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {order.cancelled_at
                          ? new Date(order.cancelled_at).toLocaleString(
                              'id-ID',
                              { timeZone: 'Asia/Jakarta' }
                            )
                          : new Date(order.created_at).toLocaleString(
                              'id-ID',
                              { timeZone: 'Asia/Jakarta' }
                            )}
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