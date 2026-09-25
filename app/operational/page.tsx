import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import RecentActivityFeed from '@/app/components/recent-activity-feed'
import OrderTablesPanel from '@/app/operational/components/order-tables-panel'
import CopyWaFormatButton from '@/app/operational/components/copy-wa-format-button'
import {
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

const changeTypeLabels: Record<string, string> = {
  change_vehicle: 'Ganti Jenis Unit',
  change_trip: 'Ubah Trip',
  change_pk: 'Ubah PK',
  change_rft: 'Ubah RFT/TR/Job',
  change_customer: 'Ubah Customer',
  change_instruction: 'Ubah Instruksi',
  change_note: 'Ubah Catatan',
  cancel_order: 'Batalkan Order',
}

function getJakartaTodayStartIso() {
  const now = new Date()
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return new Date(`${todayKey}T00:00:00+07:00`).toISOString()
}

export default async function OperationalPage() {
  const user = await requireRole(['operational'])

  const supabase = await createClient()

  const todayStartIso = getJakartaTodayStartIso()

  // `orders` dan `pendingChangeRequestRows` tidak saling butuh hasil satu
  // sama lain, jadi dijalankan paralel supaya ga nambah waktu tunggu.
  const [
    { data: orders, error: ordersError },
    { data: pendingChangeRequestRows, error: pendingChangeRequestsError },
    { data: bookingOrders, error: bookingOrdersError },
  ] = await Promise.all([
    supabase
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
      .or(
        `departure_ready_at.gte.${todayStartIso},status.in.(waiting_unit,waiting_hse,inspection,ready_loading,failed)`
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('order_change_requests')
      .select(`
        id,
        change_type,
        requested_quantity,
        requested_vehicle_type,
        reason,
        created_at,
        orders (
          id,
          customer,
          pk_number,
          rft_tr_job,
          status
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select(`
        id,
        customer,
        pk_number,
        rft_tr_job,
        booking_date,
        status,
        created_at,
        order_requirements (
          vehicle_type,
          quantity
        )
      `)
      .eq('is_booking', true)
      .in('status', ['booking_review', 'booking_confirmed', 'booking_rejected'])
      .order('booking_date', { ascending: true }),
  ])

  if (ordersError) {
    console.error('GET OPERATIONAL ORDERS ERROR:', ordersError)
  }
  if (pendingChangeRequestsError) {
    console.error('GET PENDING CHANGE REQUESTS ERROR:', pendingChangeRequestsError)
  }
  if (bookingOrdersError) {
    console.error('GET BOOKING ORDERS ERROR:', bookingOrdersError)
  }

  const bookingRows = (bookingOrders || []).map((order) => {
    const requirements = order.order_requirements || []

    const vehicleText =
      requirements
        .map(
          (requirement: { vehicle_type: string; quantity: number }) =>
            `${requirement.vehicle_type} (${requirement.quantity})`
        )
        .join(', ') || '-'

    const totalQuantity = requirements.reduce(
      (total: number, requirement: { quantity: number }) =>
        total + Number(requirement.quantity || 0),
      0
    )

    return {
      id: order.id,
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      bookingDate: order.booking_date,
      vehicleText,
      totalQuantity,
      status: order.status,
    }
  })

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

  const readyToDepartOrders = (orders || []).filter(
    (order) => order.status === 'ready_to_depart'
  )

  // Ketiga query di bawah ini (history-badge x2 + allocation log) sama-sama
  // hanya butuh activeOrderIds/activeOrders dari query orders di atas, dan
  // tidak saling butuh hasil satu sama lain — jadi digabung satu Promise.all.
  const [
    { data: orderHistoryForBadge },
    { data: unitHistoryForBadge },
    { data: allocationLogs, error: allocationLogsError },
  ] =
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
          supabase
            .from('activity_logs')
            .select(`
              order_id,
              new_value,
              created_at
            `)
            .eq('action', 'UNIT_ALLOCATION')
            .in('order_id', activeOrderIds)
            .order('created_at', { ascending: false }),
        ])
      : [{ data: [] }, { data: [] }, { data: [], error: null }]

  if (allocationLogsError) {
    console.error('GET ALLOCATION LOG ERROR:', allocationLogsError)
  }

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

  const pendingChangeRequestAlerts = (pendingChangeRequestRows || [])
    .filter((row) => row.orders)
    .map((row) => {
      const order = row.orders as unknown as {
        id: string
        customer: string
        pk_number: string | null
        rft_tr_job: string | null
        status: string
      }

      return {
        id: row.id,
        orderId: order.id,
        customer: order.customer,
        pkNumber: order.pk_number,
        rftTrJob: order.rft_tr_job,
        orderStatus: order.status,
        label: changeTypeLabels[row.change_type] || row.change_type,
        quantity: row.requested_quantity,
        vehicleType: row.requested_vehicle_type,
      }
    })

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

  const readyToDepartUnits = readyToDepartOrders.flatMap((order) =>
    (order.order_trucks || [])
      .filter(
        (truck) =>
          truck.status === 'ready_to_depart' ||
          (truck.source === 'vendor' && truck.status === 'vm')
      )
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

  const readyToDepartCount = readyToDepartUnits.length
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

    const changeVehicleRequests = pendingChangeRequests
      .filter((request) => request.change_type === 'change_vehicle')
      .map((request) => ({
        id: request.id,
        quantity: request.requested_quantity || 0,
      }))

    const otherRequests = pendingChangeRequests
      .filter(
        (request) =>
          !['reduce_unit', 'add_unit', 'change_vehicle'].includes(
            request.change_type
          )
      )
      .map((request) => ({
        id: request.id,
        label: changeTypeLabels[request.change_type] || request.change_type,
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

    const hasFailedTruck = (order.order_trucks || []).some(
      (truck) => truck.status === 'failed'
    )

    return {
      id: order.id,
      status: order.status,
      hasFailedTruck,
      avatarClass: getAvatarClass(order.customer),
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      vehicleText,
      operationalQuantity,
      filledCount: truckCount + vmCount,
      vmCount,
      unavailableCount,
      statusLabel: (order.order_trucks || []).some(
        (truck) => truck.source === 'internal' && truck.status === 'failed'
      )
        ? 'Unit Gagal HSE'
        : getStatusLabel(order.status),
      statusClass: (order.order_trucks || []).some(
        (truck) => truck.source === 'internal' && truck.status === 'failed'
      )
        ? 'bg-red-100 text-red-700'
        : getStatusClass(order.status),
      historyCount: historyCountByOrder.get(order.id) || 0,
      reduceRequests,
      addRequests,
      changeVehicleRequests,
      otherRequests,
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#2563EB]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#2563EB] shadow-sm transition hover:bg-[#2563EB]/5"
          >
            <HistoryIcon className="h-4 w-4 text-[#2563EB]" />
            History
          </Link>
        </div>
      </div>

            {pendingChangeRequestAlerts.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 text-sm font-bold text-amber-900">
            {pendingChangeRequestAlerts.length} Permintaan Perubahan Menunggu
            Persetujuan
          </p>
          <div className="space-y-2">
            {pendingChangeRequestAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/operational/orders/${alert.orderId}`}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm transition hover:bg-amber-50/60"
              >
                <div>
                  <span className="font-bold text-gray-900">
                    {alert.customer}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {alert.pkNumber || alert.rftTrJob || '-'}
                  </span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {alert.label}
                    {alert.quantity ? ` (${alert.quantity} Unit)` : ''}
                  </span>
                  {alert.orderStatus === 'ready_to_depart' && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                      Sudah Ready to Depart
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-[#2563EB]">
                  Proses →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 1 TABEL BERTAB */}
      <OrderTablesPanel
        activeOrders={activeOrderRows}
        readyUnits={readyUnits}
        readyToDepartUnits={readyToDepartUnits}
        bookingOrders={bookingRows}
        waitingUnitCount={waitingUnitCount}
        waitingHSECount={waitingHSECount}
        readyLoadingCount={readyLoadingCount}
        readyToDepartCount={readyToDepartCount}
        failedCount={failedCount}
      />
    </DashboardShell>
  )
}