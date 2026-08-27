import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ClipboardList, ArrowLeft, ArrowRight, Inbox } from 'lucide-react'

export default async function OperationalOrdersPage() {
  await requireRole(['operational'])

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

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-8">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}
        <div className="mb-8 flex items-center gap-4 border-b border-gray-200 pb-6">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-200">
            <ClipboardList className="h-5 w-5" />
          </div>

          <div>
            <Link
              href="/operational"
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Control Tower
            </Link>

            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Operational Orders
            </h1>

            <p className="mt-0.5 text-sm text-gray-500">
              Daftar order yang menunggu keputusan unit.
            </p>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Customer
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    PK / RFT
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Kendaraan
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Quantity
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Trip
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>

                  <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">

                {orders?.map((order) => (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-gray-50/80"
                  >

                    {/* CUSTOMER */}
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {order.customer}
                    </td>

                    {/* PK / RFT */}
                    <td className="px-5 py-4">
                      <div className="text-gray-900">
                        {order.pk_number}
                      </div>

                      <div className="text-xs text-gray-500">
                        {order.rft_tr_job || '-'}
                      </div>
                    </td>

                    {/* KENDARAAN */}
                    <td className="px-5 py-4 text-gray-600">
                      {order.order_requirements
                        ?.map(
                          (item) =>
                            `${item.vehicle_type} (${item.quantity})`
                        )
                        .join(', ') || '-'}
                    </td>

                    {/* QUANTITY */}
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {order.quantity} Unit
                    </td>

                    {/* TRIP */}
                    <td className="px-5 py-4 text-gray-600">
                      {order.trip}
                    </td>

                    {/* STATUS */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        Waiting Unit
                      </span>
                    </td>

                    {/* ACTION */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/operational/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>

                  </tr>
                ))}

              </tbody>
            </table>

            {/* EMPTY STATE */}
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
      </div>
    </main>
  )
}
