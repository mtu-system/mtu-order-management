import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import InspectionForm from '@/app/hse/components/inspection-form'
import VMUnitsPanel from '@/app/components/vm-units-panel'
import OrderHistoryTimeline from '@/app/components/order-history-timeline'
import { ArrowLeft } from 'lucide-react'

export default async function HSEOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['hse'])
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
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
      instruction,
      bawa_ra,
      notes,
      created_by,
      created_at,
      unit_decision,
      decision_note,
      decided_by,
      decided_at,
      order_requirements (
        id,
        vehicle_type,
        quantity
      ),
      order_trucks (
        id,
        vehicle_type,
        no_buntut,
        plate_number,
        driver_name,
        driver_phone,
        source,
        vendor_name,
        status,
        created_at,
        inspections (
          result,
          notes,
          inspected_by,
          inspected_at
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !order) {
    console.error('HSE ORDER DETAIL ERROR:', error)
    notFound()
  }

  const activeTrucks = (order.order_trucks || []).filter(
    (truck) => truck.status !== 'cancelled' && truck.source === 'internal'
  )

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="mb-8">
          <Link
            href="/hse"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#01236A] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke HSE Orders
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Detail Order HSE
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review detail order dan unit sebelum pemeriksaan HSE.
          </p>
        </div>

        {/* INFORMASI ORDER */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
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
                Status
              </p>
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {order.status}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Keputusan Operational
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {order.unit_decision || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* KEBUTUHAN KENDARAAN */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Kebutuhan Kendaraan
            </h2>
            <span className="text-sm text-gray-500">
              Total {order.quantity} Unit
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
                    Kebutuhan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.order_requirements?.map(
                  (
                    requirement: {
                      id: string
                      vehicle_type: string
                      quantity: number
                    },
                    index: number
                  ) => (
                    <tr key={requirement.id}>
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {requirement.vehicle_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {requirement.quantity} Unit
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* INSTRUKSI & CATATAN */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
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

        {/* KEPUTUSAN OPERATIONAL */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            Keputusan Operational
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Keputusan Unit
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {order.unit_decision || '-'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Catatan Keputusan
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {order.decision_note || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* DETAIL UNIT */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Detail Unit
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Unit Internal yang telah disiapkan oleh Operational. Unit
              Vendor / VM tidak masuk pemeriksaan HSE.
            </p>
          </div>

          <div className="space-y-5">
            {activeTrucks.map(
              (
                truck: {
                  id: string
                  vehicle_type: string
                  no_buntut: string | null
                  plate_number: string
                  driver_name: string
                  driver_phone: string
                  source: string | null
                  vendor_name: string | null
                  status: string
                  inspections:
                    | {
                        result: string
                        notes: string | null
                        inspected_by: string
                        inspected_at: string
                      }
                    | {
                        result: string
                        notes: string | null
                        inspected_by: string
                        inspected_at: string
                      }[]
                    | null
                },
                index: number
              ) => (
                <div
                  key={truck.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="font-bold text-gray-900">
                      Unit {index + 1}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
                      {truck.vehicle_type}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Jenis Unit
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {truck.vehicle_type}
                      </p>
                    </div>

                    {truck.no_buntut && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          No. Buntut
                        </p>
                        <p className="mt-1 font-bold text-gray-900">
                          {truck.no_buntut}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Plat Nomor
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {truck.plate_number}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Nama Driver
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {truck.driver_name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        No. HP Driver
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {truck.driver_phone}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Sumber Unit
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        {truck.source || '-'}
                      </p>
                    </div>

                    {truck.vendor_name && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Vendor
                        </p>
                        <p className="mt-1 font-bold text-gray-900">
                          {truck.vendor_name}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <h3 className="mb-3 text-sm font-bold text-gray-900">
                      Pemeriksaan HSE
                    </h3>
                    <InspectionForm
                      truckId={truck.id}
                      orderId={order.id}
                      initialInspection={
                        Array.isArray(truck.inspections)
                          ? truck.inspections[0] || null
                          : truck.inspections
                      }
                    />
                  </div>
                </div>
              )
            )}

            {!activeTrucks.length && (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                Belum ada detail unit.
              </div>
            )}
          </div>
        </div>

        {/* UNIT VENDOR / VM (READ ONLY, SHARED) */}
        <VMUnitsPanel orderId={order.id} />

        {/* RIWAYAT UNIT & ORDER */}
        <OrderHistoryTimeline orderId={order.id} />
      </div>
    </main>
  )
}