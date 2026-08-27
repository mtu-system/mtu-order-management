import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import InspectionForm from '@/app/hse/components/inspection-form'

export default async function HSEOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole(['hse'])
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

  // ==========================================
  // HANYA UNIT INTERNAL YANG DIPERIKSA HSE.
  // UNIT VM (source = 'vendor') TIDAK DITAMPILKAN
  // DAN TIDAK PERLU FORM INSPEKSI DI HALAMAN INI.
  // ==========================================

  const activeTrucks = (order.order_trucks || []).filter(
    (truck) =>
      truck.status !== 'cancelled' &&
      truck.source === 'internal'
  )

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-8">
          <Link
            href="/hse"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Kembali ke HSE Orders
          </Link>

          <h1 className="mt-4 text-2xl font-bold">
            Detail Order HSE
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review detail order dan unit sebelum pemeriksaan HSE.
          </p>
        </div>


        {/* INFORMASI ORDER */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-semibold">
            Informasi Order
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <p className="text-xs text-gray-500">
                Customer
              </p>

              <p className="mt-1 font-medium">
                {order.customer}
              </p>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                Nomor PK
              </p>

              <p className="mt-1 font-medium">
                {order.pk_number}
              </p>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                RFT / TR / Job
              </p>

              <p className="mt-1 font-medium">
                {order.rft_tr_job || '-'}
              </p>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                Trip
              </p>

              <p className="mt-1 font-medium">
                {order.trip || '-'}
              </p>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                Status
              </p>

              <span className="mt-1 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium">
                {order.status}
              </span>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                Keputusan Operational
              </p>

              <p className="mt-1 font-medium">
                {order.unit_decision || '-'}
              </p>
            </div>

          </div>

        </div>


        {/* KEBUTUHAN KENDARAAN */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">

          <div className="mb-5 flex items-center justify-between">

            <h2 className="text-lg font-semibold">
              Kebutuhan Kendaraan
            </h2>

            <span className="text-sm text-gray-500">
              Total {order.quantity} Unit
            </span>

          </div>


          <div className="overflow-hidden rounded-lg border">

            <table className="w-full text-sm">

              <thead className="bg-gray-50">

                <tr>

                  <th className="px-4 py-3 text-left">
                    No
                  </th>

                  <th className="px-4 py-3 text-left">
                    Jenis Kendaraan
                  </th>

                  <th className="px-4 py-3 text-left">
                    Kebutuhan
                  </th>

                </tr>

              </thead>


              <tbody>

                {order.order_requirements?.map(
                  (
                    requirement: {
                      id: string
                      vehicle_type: string
                      quantity: number
                    },
                    index: number
                  ) => (

                    <tr
                      key={requirement.id}
                      className="border-t"
                    >

                      <td className="px-4 py-3">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {requirement.vehicle_type}
                      </td>

                      <td className="px-4 py-3">
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

          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="mb-3 text-lg font-semibold">
              Instruksi
            </h2>

            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {order.instruction || '-'}
            </p>

          </div>


          <div className="rounded-xl border bg-white p-6 shadow-sm">

            <h2 className="mb-3 text-lg font-semibold">
              Catatan
            </h2>

            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {order.notes || '-'}
            </p>

          </div>

        </div>


        {/* KEPUTUSAN OPERATIONAL */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">

          <h2 className="mb-4 text-lg font-semibold">
            Keputusan Operational
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <p className="text-xs text-gray-500">
                Keputusan Unit
              </p>

              <p className="mt-1 font-medium">
                {order.unit_decision || '-'}
              </p>
            </div>


            <div>
              <p className="text-xs text-gray-500">
                Catatan Keputusan
              </p>

              <p className="mt-1 whitespace-pre-wrap text-sm">
                {order.decision_note || '-'}
              </p>
            </div>

          </div>

        </div>


        {/* DETAIL UNIT */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">

          <div className="mb-5">

            <h2 className="text-lg font-semibold">
              Detail Unit
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Unit Internal yang telah disiapkan oleh Operational.
              Unit Vendor / VM tidak masuk pemeriksaan HSE.
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
                  className="rounded-lg border bg-gray-50 p-4"
                >

                  {/* UNIT HEADER */}
                  <div className="mb-4 flex items-center justify-between">

                    <div className="font-medium">
                      Unit {index + 1}
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs">
                      {truck.vehicle_type}
                    </span>

                  </div>


                  {/* DETAIL */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                      <p className="text-xs text-gray-500">
                        Jenis Unit
                      </p>

                      <p className="mt-1 font-medium">
                        {truck.vehicle_type}
                      </p>
                    </div>


                    {truck.no_buntut && (
                      <div>
                        <p className="text-xs text-gray-500">
                          No. Buntut
                        </p>

                        <p className="mt-1 font-medium">
                          {truck.no_buntut}
                        </p>
                      </div>
                    )}


                    <div>
                      <p className="text-xs text-gray-500">
                        Plat Nomor
                      </p>

                      <p className="mt-1 font-medium">
                        {truck.plate_number}
                      </p>
                    </div>


                    <div>
                      <p className="text-xs text-gray-500">
                        Nama Driver
                      </p>

                      <p className="mt-1 font-medium">
                        {truck.driver_name}
                      </p>
                    </div>


                    <div>
                      <p className="text-xs text-gray-500">
                        No. HP Driver
                      </p>

                      <p className="mt-1 font-medium">
                        {truck.driver_phone}
                      </p>
                    </div>


                    <div>
                      <p className="text-xs text-gray-500">
                        Sumber Unit
                      </p>

                      <p className="mt-1 font-medium">
                        {truck.source || '-'}
                      </p>
                    </div>


                    {truck.vendor_name && (
                      <div>
                        <p className="text-xs text-gray-500">
                          Vendor
                        </p>

                        <p className="mt-1 font-medium">
                          {truck.vendor_name}
                        </p>
                      </div>
                    )}

                  </div>
                   {/* PEMERIKSAAN HSE */}
  <div className="mt-5 border-t pt-5">
    <h3 className="mb-3 text-sm font-semibold">
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
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
                Belum ada detail unit.
              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  )
}