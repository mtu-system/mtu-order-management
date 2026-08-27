import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function HSEPage() {
  await requireRole(['hse'])

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
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    console.error(
      'HSE ORDERS ERROR:',
      error
    )
  }

  // ==========================================
  // HANYA ORDER YANG MASIH PUNYA UNIT HSE
  //
  // HANYA UNIT INTERNAL YANG DIHITUNG.
  // UNIT VM TIDAK MASUK PEMERIKSAAN HSE.
  // ==========================================

  const hseOrders = (orders || []).filter(
    (order) => {
      const trucks = (
        order.order_trucks || []
      ).filter(
        (truck) =>
          truck.source === 'internal'
      )

      return trucks.some(
        (truck) =>
          truck.status === 'waiting_hse' ||
          truck.status === 'inspection'
      )
    }
  )

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-8">

          <h1 className="text-2xl font-bold">
            HSE Orders
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Daftar order yang masih memiliki unit
            yang menunggu pemeriksaan HSE.
          </p>

        </div>


        {/* TABLE */}

        <div className="overflow-hidden rounded-xl border bg-white">

          <table className="w-full text-sm">

            <thead className="bg-gray-50">

              <tr>

                <th className="px-5 py-4 text-left">
                  Customer
                </th>

                <th className="px-5 py-4 text-left">
                  PK / RFT
                </th>

                <th className="px-5 py-4 text-left">
                  Kendaraan
                </th>

                <th className="px-5 py-4 text-left">
                  Progress
                </th>

                <th className="px-5 py-4 text-left">
                  Trip
                </th>

                <th className="px-5 py-4 text-left">
                  Status
                </th>

                <th className="px-5 py-4 text-left">
                  Action
                </th>

              </tr>

            </thead>


            <tbody>

              {hseOrders.map(
                (order) => {

                  const trucks =
                    order.order_trucks || []


                  // ==========================================
                  // HANYA UNIT INTERNAL YANG AKTIF
                  //
                  // UNIT VM TIDAK MASUK PEMERIKSAAN HSE,
                  // JADI TIDAK BOLEH IKUT DIHITUNG DI SINI.
                  // ==========================================

                  const activeTrucks =
                    trucks.filter(
                      (truck) =>
                        truck.status !==
                          'cancelled' &&
                        truck.source ===
                          'internal'
                    )


                  // ==========================================
                  // TOTAL UNIT AKTIF (INTERNAL SAJA)
                  // ==========================================

                  const total =
                    activeTrucks.length


                  // ==========================================
                  // UNIT SUDAH PASSED HSE
                  // ==========================================

                  const passed =
                    activeTrucks.filter(
                      (truck) =>
                        truck.status ===
                        'ready_loading'
                    ).length


                  // ==========================================
                  // UNIT FAILED
                  // ==========================================

                  const failed =
                    activeTrucks.filter(
                      (truck) =>
                        truck.status ===
                        'failed'
                    ).length


                  // ==========================================
                  // UNIT MENUNGGU HSE
                  // ==========================================

                  const waiting =
                    activeTrucks.filter(
                      (truck) =>
                        truck.status ===
                          'waiting_hse' ||
                        truck.status ===
                          'inspection'
                    ).length


                  // ==========================================
                  // KOMPOSISI KENDARAAN AKTUAL
                  //
                  // PENTING:
                  // Jangan pakai order_requirements
                  // karena itu kebutuhan awal (termasuk VM).
                  //
                  // Gunakan activeTrucks (Internal saja)
                  // karena inilah yang benar-benar
                  // menjalani pemeriksaan HSE.
                  //
                  // Ditulis pakai for-loop biasa (bukan
                  // reduce<generic>) supaya tidak kena
                  // bug parser TypeScript di file .tsx.
                  // ==========================================

                  const vehicleCounts: Record<string, number> = {}

                  for (const truck of activeTrucks) {
                    const vehicleType =
                      truck.vehicle_type || 'Unknown'

                    vehicleCounts[vehicleType] =
                      (vehicleCounts[vehicleType] || 0) + 1
                  }


                  const vehicleSummary =
                    Object.entries(
                      vehicleCounts
                    )
                      .map(
                        ([
                          vehicleType,
                          count,
                        ]) =>
                          `${vehicleType} (${count})`
                      )
                      .join(', ')


                  return (

                    <tr
                      key={order.id}
                      className="border-t"
                    >

                      {/* CUSTOMER */}

                      <td className="px-5 py-4 font-medium">
                        {order.customer}
                      </td>


                      {/* PK / RFT */}

                      <td className="px-5 py-4">

                        <div>
                          {order.pk_number}
                        </div>

                        <div className="text-xs text-gray-500">
                          {order.rft_tr_job || '-'}
                        </div>

                      </td>


                      {/* KENDARAAN */}

                      <td className="px-5 py-4">

                        {vehicleSummary || '-'}

                      </td>


                      {/* PROGRESS */}

                      <td className="px-5 py-4">

                        <div className="font-medium">
                          {passed} / {total} Passed
                        </div>

                        <div className="mt-1 text-xs text-gray-500">

                          {waiting} Waiting

                          {failed > 0 && (
                            <>
                              {' · '}
                              {failed} Failed
                            </>
                          )}

                        </div>

                      </td>


                      {/* TRIP */}

                      <td className="px-5 py-4">
                        {order.trip}
                      </td>


                      {/* STATUS */}

                      <td className="px-5 py-4">

                        {waiting > 0 && (

                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium">

                            Waiting HSE

                          </span>

                        )}

                        {waiting === 0 &&
                          failed > 0 && (

                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium">

                              Ada Unit Failed

                            </span>

                          )}

                      </td>


                      {/* ACTION */}

                      <td className="px-5 py-4">

                        <Link
                          href={`/hse/orders/${order.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          Detail
                        </Link>

                      </td>

                    </tr>

                  )
                }
              )}

            </tbody>

          </table>


          {!hseOrders.length && (

            <div className="p-10 text-center text-sm text-gray-500">

              Tidak ada unit yang menunggu
              pemeriksaan HSE.

            </div>

          )}

        </div>

      </div>
    </main>
  )
}