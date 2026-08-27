import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'

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
        status
      )
    `)
    .eq('created_by', user.id)
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'Failed to fetch orders:',
      error
    )
  }

  return (
    <DashboardShell user={user}>
      <div>

        {/* HEADER */}

        <div className="flex items-center justify-between">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Orders
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Daftar order yang dibuat oleh Marketing.
            </p>
          </div>

          <Link
            href="/marketing/orders/create"
            className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            + Create Order
          </Link>

        </div>


        {/* TABLE */}

        <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">

          <div className="overflow-x-auto">

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
                    Kendaraan
                  </th>

                  <th className="px-6 py-4 font-semibold text-gray-700">
                    Quantity
                  </th>

                  <th className="px-6 py-4 font-semibold text-gray-700">
                    Trip
                  </th>

                  <th className="px-6 py-4 font-semibold text-gray-700">
                    Status
                  </th>

                  <th className="px-6 py-4 font-semibold text-gray-700">
                    Action
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y">

                {!orders ||
                orders.length === 0 ? (

                  <tr>

                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Belum ada order.
                    </td>

                  </tr>

                ) : (

                  orders.map((order) => {

                    // ==========================================
                    // UNIT AKTUAL
                    // ==========================================

                    const activeTrucks =
                      order.order_trucks?.filter(
                        (truck) =>
                          truck.status !==
                            'cancelled' &&
                          truck.status !==
                            'departed' &&
                          truck.status !==
                            'finished' &&
                          truck.status !==
                            'failed'
                      ) || []


                    // ==========================================
                    // RINGKASAN JENIS KENDARAAN
                    // ==========================================

                    const vehicleSummary =
                      activeTrucks.reduce(
                        (
                          result: Record<
                            string,
                            number
                          >,
                          truck
                        ) => {

                          result[
                            truck.vehicle_type
                          ] =
                            (
                              result[
                                truck.vehicle_type
                              ] || 0
                            ) + 1

                          return result

                        },
                        {}
                      )


                    const vehicleText =
                      Object.entries(
                        vehicleSummary
                      )
                        .map(
                          (
                            [
                              vehicleType,
                              quantity,
                            ]
                          ) =>
                            `${vehicleType} (${quantity})`
                        )
                        .join(', ')


                    const activeQuantity =
                      activeTrucks.length


                    return (

                      <tr
                        key={order.id}
                        className="transition hover:bg-gray-50"
                      >

                        {/* CUSTOMER */}

                        <td className="px-6 py-4 font-medium text-gray-900">
                          {order.customer}
                        </td>


                        {/* PK / RFT */}

                        <td className="px-6 py-4">

                          <div className="font-medium">
                            {order.pk_number ||
                              '-'}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {order.rft_tr_job ||
                              '-'}
                          </div>

                        </td>


                        {/* KENDARAAN */}

                        <td className="px-6 py-4">

                          {vehicleText || '-'}

                        </td>


                        {/* QUANTITY */}

                        <td className="px-6 py-4">

                          <div className="font-medium text-gray-900">
                            {activeQuantity}{' '}
                            Unit
                          </div>


                          {order.reduce_unit_requested && (

                            <div className="mt-1">

                              <div className="text-xs font-medium text-orange-600">
                                -
                                {
                                  order.reduce_unit_quantity
                                }{' '}
                                Unit{' '}
                                {
                                  order.reduce_unit_vehicle_type
                                }
                              </div>

                              <div className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                                Menunggu Operational
                              </div>

                            </div>

                          )}

                        </td>


                        {/* TRIP */}

                        <td className="max-w-xs px-6 py-4">

                          <p className="truncate">
                            {order.trip ||
                              '-'}
                          </p>

                        </td>


                        {/* STATUS */}

                        <td className="px-6 py-4">

                          <StatusBadge
                            status={
                              order.status
                            }
                          />

                        </td>


                        {/* ACTION */}

                        <td className="px-6 py-4">

                          <Link
                            href={`/marketing/orders/${order.id}`}
                            className="font-medium text-gray-900 hover:underline"
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

      </div>
    </DashboardShell>
  )
}


function StatusBadge({
  status,
}: {
  status: string | null
}) {

  const formattedStatus =
    status
      ?.replaceAll('_', ' ')
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      ) ||
    'Unknown'


  return (

    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
      {formattedStatus}
    </span>

  )

}