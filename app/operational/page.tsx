import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import RecentActivityFeed from '@/app/components/recent-activity-feed'
import OrderTablesPanel from '@/app/operational/components/order-tables-panel'
import CopyWaFormatButton from '@/app/operational/components/copy-wa-format-button'
import {
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  Truck,
  AlertTriangle,
  History as HistoryIcon,
} from 'lucide-react'

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
]

function getAvatarClass(name: string) {
  const index =
    name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    avatarColors.length
  return avatarColors[index]
}

function getStatusLabel(status: string) {
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

function getStatusClass(status: string) {
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

  const activeOrderIds = activeOrders.map((order) => order.id)

  const [{ data: orderHistoryForBadge }, { data: unitHistoryForBadge }] =
    activeOrderIds.length > 0
      ? await Promise.all([
          supabase
            .from('order_history')
            .select('order_id')
            .in('order_id', activeOrderIds),
          supabase
            .from('unit_history')
            .select('order_id')
            .in('order_id', activeOrderIds),
        ])
      : [{ data: [] }, { data: [] }]

  const historyCountByOrder = new Map<string, number>()

  for (const row of [
    ...(orderHistoryForBadge || []),
    ...(unitHistoryForBadge || []),
  ]) {
    historyCountByOrder.set(
      row.order_id,
      (historyCountByOrder.get(row.order_id) || 0) + 1
    )
  }

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
      .map((truck) => ({
        id: truck.id,
        orderId: order.id,
        customer: order.customer,
        pkNumber: order.pk_number,
        rftTrJob: order.rft_tr_job,
        vehicleType: truck.vehicle_type,
        noBuntut: truck.no_buntut,
        driverName: truck.driver_name,
      }))
  )

  const readyToDepartUnits = activeOrders.flatMap((order) =>
    (order.order_trucks || [])
      .filter((truck) => truck.status === 'ready_to_depart')
      .map((truck) => ({
        id: truck.id,
        orderId: order.id,
        customer: order.customer,
        pkNumber: order.pk_number,
        rftTrJob: order.rft_tr_job,
        vehicleType: truck.vehicle_type,
        noBuntut: truck.no_buntut,
        plateNumber: truck.plate_number,
        driverName: truck.driver_name,
      }))
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

  const activeOrderRows = activeOrders.map((order) => {
    const pendingChangeRequests =
      order.order_change_requests?.filter(
        (request) => request.status === 'pending'
      ) || []

    const reduceRequests = pendingChangeRequests
      .filter((request) => request.change_type === 'reduce_unit')
      .map((request) => ({
        id: request.id,
        quantity: request.requested_quantity || 0,
      }))

    const addRequests = pendingChangeRequests
      .filter((request) => request.change_type === 'add_unit')
      .map((request) => ({
        id: request.id,
        quantity: request.requested_quantity || 0,
      }))

    const activeOrderTrucks =
      order.order_trucks?.filter(
        (truck) =>
          truck.source === 'internal' &&
          truck.status !== 'cancelled' &&
          truck.status !== 'departed' &&
          truck.status !== 'finished' &&
          truck.status !== 'failed'
      ) || []

    const allocationHistory = latestAllocationByOrder.get(order.id) || []

    const internalAllocated = allocationHistory.reduce(
      (total, allocation) => total + Number(allocation.internal || 0),
      0
    )

    const vmCount = allocationHistory.reduce(
      (total, allocation) => total + Number(allocation.vendor || 0),
      0
    )

    const unavailableCount = allocationHistory.reduce(
      (total, allocation) => total + Number(allocation.unavailable || 0),
      0
    )

    const truckCount =
      activeOrderTrucks.length > 0
        ? activeOrderTrucks.length
        : internalAllocated

    const operationalQuantity = (order.order_requirements || []).reduce(
      (total, requirement) => total + Number(requirement.quantity || 0),
      0
    )

    const vehicleSummary = activeOrderTrucks.reduce(
      (result: Record<string, number>, truck) => {
        result[truck.vehicle_type] = (result[truck.vehicle_type] || 0) + 1
        return result
      },
      {}
    )

    const vehicleText =
      Object.entries(vehicleSummary)
        .map(([vehicleType, quantity]) => `${vehicleType} (${quantity})`)
        .join(', ') ||
      (order.order_requirements || [])
        .map(
          (requirement) =>
            `${requirement.vehicle_type} (${requirement.quantity})`
        )
        .join(', ')

    return {
      id: order.id,
      avatarClass: getAvatarClass(order.customer),
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      vehicleText,
      operationalQuantity,
      filledCount: truckCount + vmCount,
      vmCount,
      unavailableCount,
      statusLabel: getStatusLabel(order.status),
      statusClass: getStatusClass(order.status),
      historyCount: historyCountByOrder.get(order.id) || 0,
      reduceRequests,
      addRequests,
    }
  })

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

                <div className="flex items-center gap-3">
          <CopyWaFormatButton />

          <Link
            href="/operational/history"
            className="inline-flex items-center gap-2 rounded-lg border border-[#01236A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#01236A] shadow-sm transition hover:bg-[#01236A]/5"
          >
            <HistoryIcon className="h-4 w-4 text-[#01236A]" />
            History
          </Link>
        </div>
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

      {/* 1 TABEL BERTAB */}
      <OrderTablesPanel
        activeOrders={activeOrderRows}
        readyUnits={readyUnits}
        readyToDepartUnits={readyToDepartUnits}
      />
    </DashboardShell>
  )
}