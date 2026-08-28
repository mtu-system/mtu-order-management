import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import OrderChangeRequestForm from '@/app/marketing/components/order-change-request-form'
import VMUnitsPanel from '@/app/components/vm-units-panel'
import OrderHistoryTimeline from '@/app/components/order-history-timeline'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole(['marketing'])
  const { id } = await params

  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_requirements (
        id,
        vehicle_type,
        quantity
      ),
      order_trucks (
        id,
        source,
        vehicle_type,
        vendor_name,
        trip,
        no_buntut,
        plate_number,
        driver_name,
        driver_phone,
        status,
        ready_loading_at,
        departure_ready_at,
        driver_started_at,
        cancelled_at,
        cancel_reason
      )
    `)
    .eq('id', id)
    .single()

  if (error || !order) {
    notFound()
  }

  const { data: changeRequests, error: changeRequestError } = await supabase
    .from('order_change_requests')
    .select(`
      id,
      change_type,
      requested_quantity,
      reason,
      status,
      created_at
    `)
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })

  if (changeRequestError) {
    console.error('CHANGE REQUEST ERROR:', changeRequestError)
  }

  const activeTrucks =
    order.order_trucks?.filter(
      (truck: { status: string | null }) =>
        truck.status !== 'cancelled' &&
        truck.status !== 'departed' &&
        truck.status !== 'finished' &&
        truck.status !== 'failed'
    ) || []

  const activeVehicleSummary = activeTrucks.reduce(
    (result: Record<string, number>, truck: { vehicle_type: string }) => {
      result[truck.vehicle_type] = (result[truck.vehicle_type] || 0) + 1
      return result
    },
    {}
  )

  const activeVehicleEntries = Object.entries(activeVehicleSummary) as [
    string,
    number
  ][]

  const activeTotalQuantity = activeTrucks.length

  return (
    <DashboardShell user={user}>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Detail Order</h1>
          <p className="mt-1 text-sm text-gray-500">
            Detail permintaan kendaraan dan perkembangan setiap unit.
          </p>
        </div>

        <div className="space-y-6">
          {/* INFORMASI ORDER */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-bold text-gray-900">
              Informasi Order
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Customer
                </p>
                <p className="mt-1 font-bold text-gray-900">
                  {order.customer}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Nomor PK
                </p>
                <p className="mt-1 font-bold text-gray-900">
                  {order.pk_number}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  RFT / TR / Job
                </p>
                <p className="mt-1 font-bold text-gray-900">
                  {order.rft_tr_job || '-'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Trip
                </p>
                <p className="mt-1 font-bold text-gray-900">
                  {order.trip || '-'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Status Order
                </p>
                <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                  {formatOrderStatus(order.status)}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Bawa RA
                </p>
                <p className="mt-1 font-bold text-gray-900">
                  {order.bawa_ra || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* KEBUTUHAN KENDARAAN */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Kebutuhan Kendaraan
              </h2>
              <span className="text-sm text-gray-500">
                Total {activeTotalQuantity} Unit
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Jenis Kendaraan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Jumlah
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {activeVehicleEntries.length > 0 ? (
                    activeVehicleEntries.map(
                      ([vehicleType, quantity], index) => (
                        <tr key={vehicleType}>
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {vehicleType}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {quantity} Unit
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-gray-400"
                      >
                        Belum ada unit aktif.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* UNIT AKTUAL */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Unit Aktual
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Perkembangan setiap unit dalam order.
                </p>
              </div>
              <span className="rounded-full bg-[#01236A]/10 px-3 py-1 text-xs font-bold text-[#01236A]">
                Total {activeTrucks.length} Unit Aktif
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Sumber
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Kendaraan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Plat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Trip
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      No. Buntut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {order.order_trucks?.map(
                    (
                      truck: {
                        id: string
                        source: string | null
                        vehicle_type: string
                        vendor_name: string | null
                        trip: string | null
                        no_buntut: string | null
                        plate_number: string | null
                        driver_name: string | null
                        driver_phone: string | null
                        status: string | null
                        ready_loading_at: string | null
                        departure_ready_at: string | null
                        driver_started_at: string | null
                        cancelled_at: string | null
                        cancel_reason: string | null
                      },
                      index: number
                    ) => (
                      <tr key={truck.id}>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          Unit {index + 1}
                        </td>

                        <td className="px-4 py-3">
                          {truck.source === 'vendor' ? (
                            <div>
                              <div className="font-bold text-gray-900">
                                Vendor
                              </div>
                              {truck.vendor_name && (
                                <div className="text-xs text-gray-500">
                                  {truck.vendor_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-700">Internal</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-bold text-gray-900">
                          {truck.vehicle_type}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {truck.plate_number || '-'}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {truck.trip || order.trip || '-'}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {truck.no_buntut || '-'}
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-gray-900">
                            {truck.driver_name || '-'}
                          </div>
                          {truck.driver_phone && (
                            <div className="text-xs text-gray-500">
                              {truck.driver_phone}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={getTruckStatusClass(truck.status)}
                          >
                            {formatTruckStatus(truck.status)}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {!order.order_trucks?.length && (
                <div className="p-8 text-center text-sm text-gray-400">
                  Belum ada unit yang disediakan Operational.
                </div>
              )}
            </div>
          </div>

          {/* UNIT VENDOR / VM (READ ONLY, SHARED) */}
          <VMUnitsPanel orderId={order.id} />

          {/* PERUBAHAN ORDER */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Perubahan Order
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Marketing dapat mengajukan perubahan kebutuhan
                    kendaraan. Operational akan meninjau dan menentukan
                    tindakan.
                  </p>
                </div>
                <span className="rounded-full bg-[#01236A]/10 px-3 py-1 text-xs font-bold text-[#01236A]">
                  Editable
                </span>
              </div>
            </div>

            {changeRequests && changeRequests.length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-bold text-gray-700">
                  Riwayat Request Perubahan
                </h3>

                {changeRequests.map((request) => {
                  const changeTypeLabels: Record<string, string> = {
                    reduce_unit: 'Kurangi Unit',
                    add_unit: 'Tambah Unit',
                    change_vehicle: 'Ganti Jenis Unit',
                    change_trip: 'Ubah Trip',
                    cancel_order: 'Batalkan Order',
                  }

                  const changeTypeLabel =
                    changeTypeLabels[request.change_type] ||
                    request.change_type

                  return (
                    <div
                      key={request.id}
                      className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-gray-900">
                            {changeTypeLabel}
                          </p>

                          {request.requested_quantity !== null && (
                            <p className="mt-1 text-sm text-gray-600">
                              Jumlah:{' '}
                              <span className="font-bold text-gray-900">
                                {request.requested_quantity} Unit
                              </span>
                            </p>
                          )}

                          <p className="mt-2 text-sm text-gray-600">
                            {request.reason || '-'}
                          </p>
                        </div>

                        {request.status === 'pending' && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            Menunggu Operational
                          </span>
                        )}

                        {request.status === 'approved' && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            Disetujui
                          </span>
                        )}

                        {request.status === 'rejected' && (
                          <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                            Ditolak
                          </span>
                        )}
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        Diajukan{' '}
                        {new Date(request.created_at).toLocaleString(
                          'id-ID',
                          { timeZone: 'Asia/Jakarta' }
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="border-t border-gray-100 pt-5">
              <h3 className="font-bold text-gray-900">Ajukan Perubahan</h3>
              <p className="mt-1 text-sm text-gray-500">
                Perubahan tidak langsung diterapkan. Operational akan
                menentukan tindakan dan unit yang terdampak.
              </p>

              <OrderChangeRequestForm
                orderId={order.id}
                currentQuantity={activeTotalQuantity}
              />
            </div>
          </div>

          {/* INSTRUKSI & CATATAN */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                Instruksi
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600">
                {order.instruction || '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                Catatan
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600">
                {order.notes || '-'}
              </p>
            </div>
          </div>

          {/* RIWAYAT UNIT & ORDER */}
          <OrderHistoryTimeline orderId={order.id} />
        </div>
      </div>
    </DashboardShell>
  )
}

function formatOrderStatus(status: string | null) {
  switch (status) {
    case 'waiting_unit':
      return 'Menunggu Unit'
    case 'waiting_hse':
      return 'Menunggu HSE'
    case 'ready_loading':
      return 'Menunggu SJ/UJ'
    case 'ready_to_depart':
      return 'Ready to Depart'
    case 'driver_started':
      return 'Driver Sudah Jalan'
    case 'cancelled':
      return 'Cancelled'
    case 'pending':
      return 'Pending'
    default:
      return status || '-'
  }
}

function formatTruckStatus(status: string | null) {
  switch (status) {
    case 'waiting_hse':
      return 'Waiting HSE'
    case 'inspection':
      return 'Inspection'
    case 'ready_loading':
      return 'Menunggu SJ/UJ'
    case 'failed':
      return 'Failed'
    case 'unavailable':
      return 'Unavailable'
    case 'ready_to_depart':
      return 'Ready to Depart'
    case 'driver_started':
      return 'Driver Sudah Jalan'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status || '-'
  }
}

function getTruckStatusClass(status: string | null) {
  switch (status) {
    case 'ready_loading':
      return 'inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700'
    case 'ready_to_depart':
      return 'inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700'
    case 'driver_started':
      return 'inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700'
    case 'failed':
      return 'inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700'
    case 'unavailable':
      return 'inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700'
    case 'cancelled':
      return 'inline-block rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600'
    case 'inspection':
      return 'inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800'
    case 'waiting_hse':
      return 'inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800'
    default:
      return 'inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700'
  }
}