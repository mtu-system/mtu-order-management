import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import {
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  Truck,
  AlertTriangle,
} from 'lucide-react'

export default async function MarketingPage() {
  const user = await requireRole(['marketing'])

  const supabase = await createClient()

  const now = new Date()

  const jakartaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const startOfDay = new Date(`${jakartaDate}T00:00:00+07:00`)
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const { count: todayCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', startOfNextDay.toISOString())

  const { count: waitingHSECount } = await supabase
    .from('order_trucks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'waiting_hse')

  const { count: readyLoadingCount } = await supabase
    .from('order_trucks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ready_loading')

  const { data: readyDepartureUnits, error } = await supabase
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
    .order('departure_ready_at', { ascending: false })

  if (error) {
    console.error('MARKETING READY UNITS ERROR:', error)
  }

  const { count: failedCount } = await supabase
    .from('order_trucks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard Marketing
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola dan monitor permintaan kendaraan.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Order Hari Ini</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {todayCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Waiting HSE</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {waitingHSECount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <PackageCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Menunggu SJ/UJ</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {readyLoadingCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Truck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            Ready to Depart
          </p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {readyDepartureUnits?.length || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Failed</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {failedCount || 0}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Ready to Depart
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Unit yang sudah Passed HSE dan sudah dipersiapkan Operational.
          </p>
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
                    Unit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    No. Buntut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Plat
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Trip
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {readyDepartureUnits?.map((truck: any) => {
                  const order = truck.orders

                  return (
                    <tr
                      key={truck.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarClass(
                              order?.customer || '-'
                            )}`}
                          >
                            {(order?.customer || '-').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {order?.customer || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">
                          {order?.pk_number || '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order?.rft_tr_job || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {truck.vehicle_type}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {truck.no_buntut || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {truck.plate_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">
                          {truck.driver_name || '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {truck.driver_phone || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {order?.trip || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                          Ready to Depart
                        </span>
                        <div className="mt-1 text-[11px] text-gray-400">
                          SJ + UJ dibagikan
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!readyDepartureUnits?.length && (
              <div className="p-10 text-center text-sm text-gray-400">
                Belum ada unit yang Ready to Depart.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}