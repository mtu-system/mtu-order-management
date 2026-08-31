import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { Inbox } from 'lucide-react'

function getStatusLabel(status: string) {
  switch (status) {
    case 'waiting_unit':
      return 'Waiting Unit'
    case 'waiting_hse':
      return 'Waiting HSE'
    case 'inspection':
      return 'Inspection'
    case 'ready_loading':
      return 'Menunggu SJ/UJ'
    case 'ready_to_depart':
      return 'Ready to Depart'
    case 'pending':
      return 'Unit Tidak Tersedia'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'waiting_unit':
      return 'bg-amber-100 text-amber-800'
    case 'waiting_hse':
    case 'inspection':
      return 'bg-blue-100 text-blue-800'
    case 'ready_loading':
      return 'bg-emerald-100 text-emerald-800'
    case 'ready_to_depart':
      return 'bg-violet-100 text-violet-800'
    case 'pending':
      return 'bg-gray-200 text-gray-700'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
]

function getAvatarClass(name: string) {
  const index =
    name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    avatarColors.length
  return avatarColors[index]
}

export default async function ManagerOrdersPage() {
  const user = await requireRole(['manager'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      trip,
      quantity,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('MANAGER ORDERS LIST ERROR:', error)
  }

  const allOrders = orders || []

  return (
    <DashboardShell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-xs text-gray-500">
            Semua order dalam sistem — read only monitoring.
          </p>
        </div>

        <span className="rounded-full bg-[#01236A]/10 px-3.5 py-1.5 text-xs font-bold text-[#01236A]">
          {allOrders.length} Order
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  PK / RFT
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Quantity
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Trip
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Dibuat
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {allOrders.map((order) => (
                <tr
                  key={order.id}
                  className="transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarClass(
                          order.customer
                        )}`}
                      >
                        {order.customer.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-gray-900">
                        {order.customer}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="text-gray-900">
                      {order.pk_number || '-'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {order.rft_tr_job || '-'}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 font-semibold text-gray-900">
                    {order.quantity} Unit
                  </td>

                  <td className="px-5 py-3.5 text-gray-600">
                    {order.trip || '-'}
                  </td>

                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusClass(
                        order.status
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-gray-500">
                    {new Date(order.created_at).toLocaleString('id-ID', {
                      timeZone: 'Asia/Jakarta',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!allOrders.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">Belum ada order.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}