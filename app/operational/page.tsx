import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import {
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  Truck,
  AlertTriangle,
  ArrowRight,
  Inbox,
  MinusCircle,
  PlusCircle,
  History,
} from 'lucide-react'

export default async function OperationalPage() {
  const user = await requireRole(['operational'])

  const supabase = await createClient()

  const { data: orders, error: ordersError } = await supabase
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
        vehicle_type,
        quantity
      ),
      order_change_requests (
        id,
        change_type,
        requested_quantity,
        reason,
        status,
        created_at
      ),
      order_trucks (
        id,
        vehicle_type,
        no_buntut,
        plate_number,
        driver_name,
        status,
        source
      )
    `)
    .in('status', [
      'waiting_unit',
      'waiting_hse',
      'inspection',
      'ready_loading',
      'ready_to_depart',
      'failed',
    ])
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('GET OPERATIONAL ORDERS ERROR:', ordersError)
  }

  const activeOrders = (orders || []).filter((order) => {
    if (order.status === 'ready_to_depart') {
      return false
    }

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )

      if (internalTrucks.length === 0) {
        return false
      }
    }

    return true
  })

  const { data: allocationLogs, error: allocationLogsError } =
    await supabase
      .from('activity_logs')
      .select(`
        order_id,
        new_value,
        created_at
      `)
      .eq('action', 'UNIT_ALLOCATION')
      .in(
        'order_id',
        activeOrders.map((order) => order.id)
      )
      .order('created_at', { ascending: false })

  if (allocationLogsError) {
    console.error('GET ALLOCATION LOG ERROR:', allocationLogsError)
  }

  type AllocationEntry = {
    vehicle_type: string
    internal: number
    vendor: number
    unavailable: number
  }

  const latestAllocationByOrder: Map<string, AllocationEntry[]> = new Map()

  for (const log of allocationLogs || []) {
    if (latestAllocationByOrder.has(log.order_id)) {
      continue
    }

    try {
      const parsed =
        typeof log.new_value === 'string'
          ? JSON.parse(log.new_value)
          : log.new_value

      if (Array.isArray(parsed)) {
        latestAllocationByOrder.set(log.order_id, parsed)
      }
    } catch (error) {
      console.error('PARSE ALLOCATION LOG ERROR:', error)
    }
  }

  const readyUnits = activeOrders.flatMap((order) =>
    (order.order_trucks || [])
      .filter((truck) => truck.status === 'ready_loading')
      .map((truck) => ({ ...truck, order }))
  )

  const readyToDepartUnits = activeOrders.flatMap((order) =>
    (order.order_trucks || [])
      .filter((truck) => truck.status === 'ready_to_depart')
      .map((truck) => ({ ...truck, order }))
  )

  const activeTrucks = activeOrders.flatMap((order) =>
    (order.order_trucks || []).filter(
      (truck) =>
        truck.status !== 'cancelled' &&
        truck.status !== 'departed' &&
        truck.status !== 'finished' &&
        truck.status !== 'failed'
    )
  )

  const waitingUnitCount = activeOrders.filter(
    (order) => order.status === 'waiting_unit'
  ).length

  const waitingHSECount = activeTrucks.filter(
    (truck) => truck.status === 'waiting_hse' || truck.status === 'inspection'
  ).length

  const readyLoadingCount = activeTrucks.filter(
    (truck) => truck.status === 'ready_loading'
  ).length

  const readyToDepartCount = activeTrucks.filter(
    (truck) => truck.status === 'ready_to_depart'
  ).length

  const failedCount = activeTrucks.filter(
    (truck) => truck.status === 'failed'
  ).length

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting_unit':
        return 'Waiting Unit'
      case 'waiting_hse':
        return 'Waiting HSE'
      case 'vm':
        return 'VM'
      case 'inspection':
        return 'Inspection'
      case 'ready_loading':
        return 'Menunggu SJ/UJ'
      case 'ready_to_depart':
        return 'Ready to Depart'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  const getStatusClass = (status: string) => {
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
      case 'failed':
        return 'bg-red-100 text-red-800'
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

  const getAvatarClass = (name: string) => {
    const index =
      name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      avatarColors.length
    return avatarColors[index]
  }

  return (
    <DashboardShell user={user}>
      {/* HEADER */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Operational Control Tower
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor order, unit, pemeriksaan HSE, dan kesiapan keberangkatan.
          </p>
        </div>

     <Link
  href="/operational/history"
  className="inline-flex items-center gap-2 rounded-lg border border-[#01236A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#01236A] shadow-sm transition hover:bg-[#01236A]/5"
>
  <History className="h-4 w-4 text-[#01236A]" />
  History
</Link>
      </div>

      {/* STATISTIK */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Waiting Unit</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {waitingUnitCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Waiting HSE</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {waitingHSECount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <PackageCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Menunggu SJ/UJ</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {readyLoadingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Truck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Ready to Depart</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {readyToDepartCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-gray-500">Failed</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {failedCount}
          </p>
        </div>
      </div>

      {/* ORDER AKTIF */}
      <div className="mb-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Order Aktif</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Semua order yang masih dalam proses Operational.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
            {activeOrders.length} Order
          </span>
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
                    Kendaraan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Quantity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Unit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Perubahan
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {activeOrders.map((order) => {
                  const pendingChangeRequests =
                    order.order_change_requests?.filter(
                      (request) => request.status === 'pending'
                    ) || []

                  const reduceRequests = pendingChangeRequests.filter(
                    (request) => request.change_type === 'reduce_unit'
                  )

                  const addRequests = pendingChangeRequests.filter(
                    (request) => request.change_type === 'add_unit'
                  )

                  const activeOrderTrucks =
                    order.order_trucks?.filter(
                      (truck) =>
                        truck.source === 'internal' &&
                        truck.status !== 'cancelled' &&
                        truck.status !== 'departed' &&
                        truck.status !== 'finished' &&
                        truck.status !== 'failed'
                    ) || []

                  const allocationHistory =
                    latestAllocationByOrder.get(order.id) || []

                  const internalAllocated = allocationHistory.reduce(
                    (total, allocation) =>
                      total + Number(allocation.internal || 0),
                    0
                  )

                  const vmCount = allocationHistory.reduce(
                    (total, allocation) =>
                      total + Number(allocation.vendor || 0),
                    0
                  )

                  const unavailableCount = allocationHistory.reduce(
                    (total, allocation) =>
                      total + Number(allocation.unavailable || 0),
                    0
                  )

                  const truckCount =
                    activeOrderTrucks.length > 0
                      ? activeOrderTrucks.length
                      : internalAllocated

                  const operationalQuantity = (
                    order.order_requirements || []
                  ).reduce(
                    (total, requirement) =>
                      total + Number(requirement.quantity || 0),
                    0
                  )

                  const vehicleSummary = activeOrderTrucks.reduce(
                    (result: Record<string, number>, truck) => {
                      result[truck.vehicle_type] =
                        (result[truck.vehicle_type] || 0) + 1
                      return result
                    },
                    {}
                  )

                  const vehicleText = Object.entries(vehicleSummary)
                    .map(
                      ([vehicleType, quantity]) =>
                        `${vehicleType} (${quantity})`
                    )
                    .join(', ')

                  return (
                    <tr
                      key={order.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarClass(
                              order.customer
                            )}`}
                          >
                            {order.customer.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">
                            {order.customer}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-gray-900">
                          {order.pk_number || '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.rft_tr_job || '-'}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {vehicleText ||
                          (order.order_requirements || [])
                            .map(
                              (requirement) =>
                                `${requirement.vehicle_type} (${requirement.quantity})`
                            )
                            .join(', ') ||
                          '-'}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">
                          {operationalQuantity} Unit
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-gray-900">
                              {truckCount + vmCount}/{operationalQuantity}
                            </span>

                            {vmCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                VM {vmCount}
                              </span>
                            )}

                            {unavailableCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                Tidak Tersedia {unavailableCount}
                              </span>
                            )}
                          </div>

                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                            <div
  className="h-full rounded-full bg-[#01236A]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((truckCount + vmCount) /
                                    Math.max(operationalQuantity, 1)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {reduceRequests.map((request) => (
                            <span
                              key={request.id}
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700"
                            >
                              <MinusCircle className="h-3 w-3" />
                              {request.requested_quantity || 0} Unit
                            </span>
                          ))}

                          {addRequests.map((request) => (
                            <span
                              key={request.id}
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700"
                            >
                              <PlusCircle className="h-3 w-3" />
                              {request.requested_quantity || 0} Unit
                            </span>
                          ))}

                          {!pendingChangeRequests.length && (
                            <span className="text-gray-300">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                       <Link
  href={`/operational/orders/${order.id}`}
  className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
>
  Proses
  <ArrowRight className="h-3.5 w-3.5" />
</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!activeOrders.length && (
              <div className="flex flex-col items-center gap-3 p-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-400">Tidak ada order aktif.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UNIT MENUNGGU SJ/UJ */}
      <div className="mb-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Unit Menunggu SJ/UJ
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Unit yang sudah Passed HSE dan dapat diproses
              keberangkatannya.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {readyUnits.length} Unit
          </span>
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
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {readyUnits.map((truck) => {
                  const order = truck.order

                  return (
                    <tr
                      key={truck.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {order?.customer || '-'}
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
                        {truck.driver_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Menunggu SJ/UJ
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/operational/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Proses
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!readyUnits.length && (
              <div className="flex flex-col items-center gap-3 p-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-400">
                  Belum ada unit yang Passed HSE.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UNIT READY TO DEPART */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Unit Ready to Depart
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Unit yang sudah Passed HSE dan Surat Jalan serta Uang Jalan
              sudah dibagikan.
            </p>
          </div>
          <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
            {readyToDepartUnits.length} Unit
          </span>
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
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {readyToDepartUnits.map((truck) => {
                  const order = truck.order

                  return (
                    <tr
                      key={truck.id}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {order?.customer || '-'}
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
                      <td className="px-6 py-4 text-gray-600">
                        {truck.driver_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                          Ready to Depart
                        </span>
                        <div className="mt-1 text-[11px] text-gray-400">
                          SJ + UJ sudah dibagikan
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {!readyToDepartUnits.length && (
              <div className="flex flex-col items-center gap-3 p-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-400">
                  Belum ada unit yang Ready to Depart.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}