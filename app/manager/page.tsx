import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import OrderTrendChart from '@/app/manager/components/order-trend-chart'
import OrderStatusDonut from '@/app/manager/components/order-status-donut'
import {
  ClipboardList,
  Inbox,
  Loader2,
  PackageCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'

function getJakartaDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function getJakartaDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${dateKey}T00:00:00+07:00`))
}

const actorLabel: Record<string, string> = {
  create_order: 'Marketing',
  reduce_unit: 'Operational',
  add_unit: 'Operational',
  change_vehicle: 'Operational',
  change_trip: 'Operational',
  change_pk: 'Operational',
  change_rft: 'Operational',
  change_customer: 'Operational',
  change_instruction: 'Operational',
  change_note: 'Operational',
  cancel_order: 'Operational',
  replace_failed_unit: 'Operational',
  failed_unit_to_vendor: 'Operational',
  cancel_failed_unit: 'Operational',
  hse_inspection: 'HSE',
  ready_to_depart: 'Operational',
}

const activityMessage: Record<string, string> = {
  create_order: 'Order baru dibuat',
  reduce_unit: 'Unit dikurangi dari order',
  add_unit: 'Unit ditambahkan ke order',
  change_vehicle: 'Jenis unit diganti',
  change_trip: 'Trip diubah',
  change_pk: 'Nomor PK diubah',
  change_rft: 'RFT/TR/Job diubah',
  change_customer: 'Customer diubah',
  change_instruction: 'Instruksi diubah',
  change_note: 'Catatan diubah',
  cancel_order: 'Order dibatalkan',
  replace_failed_unit: 'Detail unit Failed diganti',
  failed_unit_to_vendor: 'Unit Failed dialihkan ke Vendor',
  cancel_failed_unit: 'Unit Failed dibatalkan',
  hse_inspection: 'Pemeriksaan HSE',
  ready_to_depart: 'SJ & UJ dikonfirmasi, unit Ready to Depart',
}

export default async function ManagerDashboardPage() {
  const user = await requireRole(['manager'])

  const supabase = await createClient()

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      status,
      unit_decision,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('MANAGER ORDERS ERROR:', ordersError)
  }

  const allOrders = orders || []

  const newCount = allOrders.filter(
    (order) => order.status === 'waiting_unit'
  ).length

  const processCount = allOrders.filter(
    (order) => order.status === 'waiting_hse' || order.status === 'inspection'
  ).length

  const allocatedCount = allOrders.filter(
    (order) => order.status === 'ready_loading'
  ).length

  const readyCount = allOrders.filter(
    (order) => order.status === 'ready_to_depart'
  ).length

  const totalCount = newCount + processCount + allocatedCount + readyCount

  const statusBuckets = [
    {
      label: 'Waiting Unit',
      count: newCount,
      colorHex: '#f59e0b',
      colorClass: 'bg-amber-500',
    },
    {
      label: 'Waiting HSE',
      count: processCount,
      colorHex: '#3b82f6',
      colorClass: 'bg-blue-500',
    },
    {
      label: 'Menunggu SJ/UJ',
      count: allocatedCount,
      colorHex: '#10b981',
      colorClass: 'bg-emerald-500',
    },
    {
      label: 'Ready to Depart',
      count: readyCount,
      colorHex: '#8b5cf6',
      colorClass: 'bg-violet-500',
    },
    {
      label: 'Unit Tidak Tersedia',
      count: allOrders.filter((order) => order.status === 'pending').length,
      colorHex: '#9ca3af',
      colorClass: 'bg-gray-400',
    },
    {
      label: 'Cancelled',
      count: allOrders.filter((order) => order.status === 'cancelled')
        .length,
      colorHex: '#f87171',
      colorClass: 'bg-red-400',
    },
  ]

  function buildTrend(days: number) {
    const today = new Date()
    const keys: string[] = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      keys.push(getJakartaDateKey(date.toISOString()))
    }

    const countByDay = new Map<string, number>()

    for (const order of allOrders) {
      const key = getJakartaDateKey(order.created_at)
      countByDay.set(key, (countByDay.get(key) || 0) + 1)
    }

    return keys.map((key) => ({
      label: getJakartaDayLabel(key),
      count: countByDay.get(key) || 0,
    }))
  }

  const trend7 = buildTrend(7)
  const trend30 = buildTrend(30)

  const needsAttention: { orderId: string; label: string; reason: string }[] =
    []

  for (const order of allOrders) {
    const title = `${order.customer} — ${order.pk_number || '-'}`

    if (order.status === 'waiting_unit' && !order.unit_decision) {
      needsAttention.push({
        orderId: order.id,
        label: title,
        reason: 'Belum ada keputusan unit',
      })
    } else if (
      order.status === 'waiting_unit' &&
      order.unit_decision === 'available'
    ) {
      needsAttention.push({
        orderId: order.id,
        label: title,
        reason: 'Sudah diputuskan tersedia, belum dialokasikan',
      })
    } else if (order.status === 'pending') {
      needsAttention.push({
        orderId: order.id,
        label: title,
        reason: 'Unit tidak tersedia — menunggu tindakan Marketing',
      })
    } else if (order.status === 'ready_loading') {
      needsAttention.push({
        orderId: order.id,
        label: title,
        reason: 'Menunggu SJ/UJ dari Operational',
      })
    }
  }

  const { data: failedTrucksRaw } = await supabase
    .from('order_trucks')
    .select('order_id, orders ( customer, pk_number )')
    .eq('status', 'failed')

  for (const truck of failedTrucksRaw || []) {
    const order = (truck as any).orders

    needsAttention.push({
      orderId: truck.order_id,
      label: `${order?.customer || '-'} — ${order?.pk_number || '-'}`,
      reason: 'Ada unit Failed, perlu tindakan Operational',
    })
  }

  const needsAttentionList = needsAttention.slice(0, 6)

  const { data: readyTrucks, error: readyTrucksError } = await supabase
    .from('order_trucks')
    .select(`
      id,
      vehicle_type,
      driver_name,
      no_buntut,
      plate_number,
      orders (
        pk_number,
        customer,
        trip
      )
    `)
    .eq('status', 'ready_to_depart')
    .order('departure_ready_at', { ascending: false })
    .limit(8)

  if (readyTrucksError) {
    console.error('MANAGER READY TRUCKS ERROR:', readyTrucksError)
  }

  const [{ data: orderHistoryRaw }, { data: unitHistoryRaw }] =
    await Promise.all([
      supabase
        .from('order_history')
        .select(`
          id,
          action,
          new_value,
          changed_at,
          orders ( customer, pk_number )
        `)
        .order('changed_at', { ascending: false })
        .limit(10),
      supabase
        .from('unit_history')
        .select(`
          id,
          action,
          new_value,
          changed_at,
          orders ( customer, pk_number )
        `)
        .order('changed_at', { ascending: false })
        .limit(10),
    ])

  const recentActivity = [
    ...(orderHistoryRaw || []).map((item: any) => ({ ...item })),
    ...(unitHistoryRaw || []).map((item: any) => ({ ...item })),
  ]
    .sort(
      (a, b) =>
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    )
    .slice(0, 6)

  const kpiItems = [
    {
      label: 'Total Order',
      value: totalCount,
      icon: ClipboardList,
      color: 'text-[#01236A]',
    },
    {
      label: 'Order Baru',
      value: newCount,
      icon: Inbox,
      color: 'text-amber-600',
    },
    {
      label: 'Dalam Proses',
      value: processCount,
      icon: Loader2,
      color: 'text-blue-600',
    },
    {
      label: 'Dialokasikan',
      value: allocatedCount,
      icon: PackageCheck,
      color: 'text-emerald-600',
    },
    {
      label: 'Ready to Depart',
      value: readyCount,
      icon: Truck,
      color: 'text-violet-600',
    },
    {
      label: 'Attention',
      value: needsAttention.length,
      icon: AlertTriangle,
      color: needsAttention.length > 0 ? 'text-red-600' : 'text-gray-300',
    },
  ]

  return (
    <DashboardShell user={user}>
      {/* HEADER */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Manager Dashboard
          </h1>
          <p className="text-xs text-gray-500">
            Overview kondisi order dari Marketing sampai Ready to Depart.
          </p>
        </div>

        <span className="rounded-full bg-[#01236A]/10 px-3.5 py-1.5 text-xs font-bold text-[#01236A]">
          {new Date().toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>

      {/* KPI STRIP — 1 KARTU, COMPACT */}
      <div className="mb-5 grid grid-cols-2 divide-x divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        {kpiItems.map((item) => {
          const Icon = item.icon

          return (
            <div key={item.label} className="flex items-center gap-3 px-5 py-4">
              <Icon className={`h-4.5 w-4.5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-lg font-bold leading-tight text-gray-900">
                  {item.value}
                </p>
                <p className="text-[11px] font-medium leading-tight text-gray-500">
                  {item.label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* TREND + STATUS */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 className="mb-3 text-sm font-bold text-gray-900">
            Order History
          </h2>
          <OrderTrendChart data7={trend7} data30={trend30} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-gray-900">
            Order Status
          </h2>
          <OrderStatusDonut buckets={statusBuckets} />
        </div>
      </div>

      {/* UNIT READY TO DEPART — COMPACT */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Truck className="h-4 w-4 text-gray-400" />
            Unit Ready to Depart
          </h2>
          <span className="text-xs font-semibold text-gray-400">
            {readyTrucks?.length || 0} unit
          </span>
        </div>

        {readyTrucks?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Unit
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Driver
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Order
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Customer
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Tujuan
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {readyTrucks.map((truck: any) => (
                  <tr key={truck.id}>
                    <td className="px-5 py-2.5">
                      <p className="font-bold text-gray-900">
                        {truck.vehicle_type}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {truck.plate_number || '-'}
                        {truck.no_buntut ? ` · ${truck.no_buntut}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-2.5 text-gray-700">
                      {truck.driver_name || '-'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-700">
                      {truck.orders?.pk_number || '-'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-700">
                      {truck.orders?.customer || '-'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-700">
                      {truck.orders?.trip || '-'}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        Ready
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-4 text-sm text-gray-400">
            Belum ada unit yang Ready to Depart.
          </div>
        )}
      </div>

      {/* NEEDS ATTENTION + RECENT ACTIVITY */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900">
              Needs Attention
            </h2>
            {needsAttentionList.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {needsAttention.length}
              </span>
            )}
          </div>

          {needsAttentionList.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {needsAttentionList.map((item, index) => (
                <div
                  key={`${item.orderId}-${index}`}
                  className="flex items-center gap-3 border-l-2 border-amber-400 px-5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {item.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-4 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Semua order berjalan normal
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">
              Recent Activity
            </h2>
          </div>

          {recentActivity.length > 0 ? (
            <div className="px-5 py-3">
              {recentActivity.map((item: any, index) => {
                const time = new Date(item.changed_at).toLocaleTimeString(
                  'id-ID',
                  {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )

                const actor = actorLabel[item.action] || 'System'
                let message = activityMessage[item.action] || item.action

                if (item.action === 'hse_inspection' && item.new_value) {
                  message = `Pemeriksaan HSE — ${item.new_value}`
                }

                return (
                  <div key={item.id} className="flex gap-2.5 py-1.5">
                    <div className="flex flex-col items-center pt-1.5">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#01236A]" />
                      {index < recentActivity.length - 1 && (
                        <div className="mt-0.5 w-px flex-1 bg-gray-100" />
                      )}
                    </div>

                    <div className="min-w-0 pb-1">
                      <p className="text-[11px] font-bold text-gray-400">
                        {time} · {actor}
                      </p>
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {message}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-gray-400">
              Belum ada aktivitas.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}