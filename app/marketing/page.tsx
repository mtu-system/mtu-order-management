import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'

export default async function MarketingPage() {
  const user = await requireRole(['marketing'])

  const supabase = await createClient()

  // ==========================================
  // 1. ORDER HARI INI
  // ==========================================

// ==========================================
// 1. ORDER HARI INI
// ==========================================

// Hari ini berdasarkan WIB (Asia/Jakarta)
const now = new Date()

const jakartaDate = new Intl.DateTimeFormat(
  'en-CA',
  {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
).format(now)

// Awal hari WIB dalam UTC
const startOfDay = new Date(
  `${jakartaDate}T00:00:00+07:00`
)

// Awal besok WIB dalam UTC
const startOfNextDay = new Date(
  startOfDay.getTime() + 24 * 60 * 60 * 1000
)

const { count: todayCount } = await supabase
  .from('orders')
  .select('id', {
    count: 'exact',
    head: true,
  })
  .gte(
    'created_at',
    startOfDay.toISOString()
  )
  .lt(
    'created_at',
    startOfNextDay.toISOString()
  )

  // ==========================================
  // 2. UNIT MENUNGGU HSE
  // ==========================================

  const { count: waitingHSECount } = await supabase
    .from('order_trucks')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'waiting_hse')

  // ==========================================
  // 3. UNIT READY LOADING
  // ==========================================

  const { count: readyLoadingCount } = await supabase
    .from('order_trucks')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'ready_loading')

  // ==========================================
  // 4. UNIT SIAP BERANGKAT
  // ==========================================

  const { data: readyDepartureUnits, error } =
    await supabase
      .from('order_trucks')
      .select(`
        id,
        order_id,
        vehicle_type,
        no_buntut,
        plate_number,
        driver_name,
        driver_phone,
        status,
        surat_jalan_distributed,
        uang_jalan_distributed,
        departure_ready_at,
        orders (
          id,
          customer,
          pk_number,
          rft_tr_job,
          trip
        )
      `)
      .eq('status', 'ready_to_depart')
      .order('departure_ready_at', {
        ascending: false,
      })

  if (error) {
    console.error(
      'MARKETING READY UNITS ERROR:',
      error
    )
  }

  // ==========================================
  // 5. UNIT FAILED
  // ==========================================

  const { count: failedCount } = await supabase
    .from('order_trucks')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'failed')

  return (
    <DashboardShell user={user}>
      <div>

        {/* HEADER */}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard Marketing
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Kelola dan monitor permintaan kendaraan.
          </p>
        </div>


        {/* SUMMARY */}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">

          <DashboardCard
            title="Order Hari Ini"
            value={String(todayCount || 0)}
          />

          <DashboardCard
            title="Waiting HSE"
            value={String(waitingHSECount || 0)}
          />

          <DashboardCard
            title="Ready Loading"
            value={String(readyLoadingCount || 0)}
          />

          <DashboardCard
            title="Ready to Depart"
            value={String(
              readyDepartureUnits?.length || 0
            )}
          />

          <DashboardCard
            title="Failed"
            value={String(failedCount || 0)}
          />

        </div>


        {/* ==========================================
            UNIT SIAP BERANGKAT
        ========================================== */}

        <div className="mt-8">

          <div className="mb-5">

            <h2 className="text-xl font-semibold text-gray-900">
              Ready to Depart
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Unit yang sudah Passed HSE dan sudah
              dipersiapkan Operational.
            </p>

          </div>


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
                    Unit
                  </th>

                  <th className="px-5 py-4 text-left">
                    No. Buntut
                  </th>

                  <th className="px-5 py-4 text-left">
                    Plat
                  </th>

                  <th className="px-5 py-4 text-left">
                    Driver
                  </th>

                  <th className="px-5 py-4 text-left">
                    Trip
                  </th>

                  <th className="px-5 py-4 text-left">
                    Status
                  </th>

                </tr>

              </thead>


              <tbody>

                {readyDepartureUnits?.map(
                  (truck: any) => {

                    const order =
                      truck.orders

                    return (

                      <tr
                        key={truck.id}
                        className="border-t"
                      >

                        {/* CUSTOMER */}

                        <td className="px-5 py-4 font-medium">
                          {order?.customer || '-'}
                        </td>


                        {/* PK / RFT */}

                        <td className="px-5 py-4">

                          <div>
                            {order?.pk_number || '-'}
                          </div>

                          <div className="text-xs text-gray-500">
                            {order?.rft_tr_job || '-'}
                          </div>

                        </td>


                        {/* UNIT */}

                        <td className="px-5 py-4 font-medium">
                          {truck.vehicle_type}
                        </td>


                        {/* NO BUNTUT */}

                        <td className="px-5 py-4">
                          {truck.no_buntut || '-'}
                        </td>


                        {/* PLAT */}

                        <td className="px-5 py-4">
                          {truck.plate_number || '-'}
                        </td>


                        {/* DRIVER */}

                        <td className="px-5 py-4">

                          <div>
                            {truck.driver_name || '-'}
                          </div>

                          <div className="text-xs text-gray-500">
                            {truck.driver_phone || '-'}
                          </div>

                        </td>


                        {/* TRIP */}

                        <td className="px-5 py-4">
                          {order?.trip || '-'}
                        </td>


                        {/* STATUS */}

                        <td className="px-5 py-4">

                          <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                           Ready to Depart
                          </span>

                          <div className="mt-1 text-xs text-gray-500">
                            SJ + UJ dibagikan
                          </div>

                        </td>

                      </tr>

                    )
                  }
                )}

              </tbody>

            </table>


            {!readyDepartureUnits?.length && (

              <div className="p-10 text-center text-sm text-gray-500">
                Belum ada unit yang Ready to Depart.
              </div>

            )}

          </div>

        </div>

      </div>
    </DashboardShell>
  )
}


function DashboardCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-gray-900">
        {value}
      </p>

    </div>
  )
}