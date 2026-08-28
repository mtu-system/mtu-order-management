import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { Inbox } from 'lucide-react'

export default async function OperationalHistoryPage() {
  const user = await requireRole(['operational'])

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
      cancel_reason,
      cancelled_at,
      decision_note,
      created_at,
      order_trucks (
        id,
        vehicle_type,
        source,
        status
      )
    `)
    .in('status', ['cancelled', 'ready_to_depart', 'ready_loading', 'pending'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET OPERATIONAL HISTORY ERROR:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return true
    if (order.status === 'ready_to_depart') return true
    if (order.status === 'pending') return true

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      return internalTrucks.length === 0
    }

    return false
  })

  const getReasonLabel = (order: (typeof historyOrders)[number]) => {
    if (order.status === 'cancelled') return order.cancel_reason || '-'
    if (order.status === 'pending')
      return (
        order.decision_note ||
        'Unit Tidak Tersedia — menunggu tindakan Marketing'
      )
    if (order.status === 'ready_to_depart')
      return 'Selesai — semua unit Ready to Depart'
    return 'Selesai — dipenuhi Vendor / VM'
  }

  const getStatusBadge = (order: (typeof historyOrders)[number]) => {
    if (order.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
          Cancelled
        </span>
      )
    }
    if (order.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
          Unit Tidak Tersedia
        </span>
      )
    }
    if (order.status === 'ready_to_depart') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
          Ready to Depart
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Order yang sudah tidak butuh tindakan lagi dari Operational —
          selesai, Ready to Depart, dibatalkan, Unit Tidak Tersedia, atau
          full-VM.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  PK / RFT
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Quantity
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Kendaraan
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Trip
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Keterangan
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Tanggal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {historyOrders.map((order) => {
                const { internalCount, vmCount } = getVehicleBreakdown(order)

                return (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {order.customer}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-gray-900">
                        {order.pk_number || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.rft_tr_job || '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">
                      {order.quantity} Unit
                    </td>
                    <td className="px-5 py-4">
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
                    <td className="px-5 py-4 text-gray-600">
                      {order.trip || '-'}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(order)}</td>
                    <td className="max-w-xs px-5 py-4 text-gray-600">
                      {getReasonLabel(order)}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {order.cancelled_at
                        ? new Date(order.cancelled_at).toLocaleString(
                            'id-ID',
                            { timeZone: 'Asia/Jakarta' }
                          )
                        : new Date(order.created_at).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                          })}
                    </td>
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
              <p className="text-sm text-gray-400">Belum ada history.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}