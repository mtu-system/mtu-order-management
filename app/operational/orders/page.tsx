import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import { ArrowRight, Inbox } from 'lucide-react'

export default async function OperationalOrdersPage() {
  const user = await requireRole(['operational'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      vehicle_type,
      quantity,
      trip,
      status,
      created_at,
      order_requirements (
        id,
        vehicle_type,
        quantity
      )
    `)
    .eq('status', 'waiting_unit')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('OPERATIONAL ORDERS ERROR:', error)
  }

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waiting Unit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Daftar order yang menunggu keputusan unit dari Operational.
          </p>
        </div>

        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
          {orders?.length || 0} Order
        </span>
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
                  Quantity
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
              {orders?.map((order) => (
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
                    {order.order_requirements
                      ?.map(
                        (item) => `${item.vehicle_type} (${item.quantity})`
                      )
                      .join(', ') || '-'}
                  </td>

                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {order.quantity} Unit
                  </td>

                  <td className="px-6 py-4 text-gray-600">{order.trip}</td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Waiting Unit
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/operational/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
                    >
                      Detail
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!orders?.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">
                Tidak ada order yang menunggu unit.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}