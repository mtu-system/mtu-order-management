import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  Truck,
  AlertTriangle,
  ArrowRight,
  Inbox,
  MinusCircle,
  PlusCircle,
} from 'lucide-react'

export default async function OperationalPage() {
  const user = await requireRole(['operational'])

  const supabase = await createClient()

  // ==========================================
  // AMBIL SEMUA ORDER AKTIF
  // ==========================================

  const {
    data: orders,
    error: ordersError,
  } = await supabase
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
    .order('created_at', {
      ascending: false,
    })

  if (ordersError) {
    console.error(
      'GET OPERATIONAL ORDERS ERROR:',
      ordersError
    )
  }

  // ==========================================
  // ORDER AKTIF
  //
  // Ready to Depart tidak ditampilkan sebagai
  // order aktif utama.
  // ==========================================

  const activeOrders = (orders || []).filter(
    (order) =>
      order.status !== 'ready_to_depart'
  )

  // ==========================================
  // AMBIL HISTORY ALOKASI UNIT
  //
  // VM TIDAK disimpan sebagai order_trucks.
  // VM dibaca dari activity_logs.
  // ==========================================

  const {
    data: allocationLogs,
    error: allocationLogsError,
  } = await supabase
    .from('activity_logs')
    .select(`
      order_id,
      new_value,
      created_at
    `)
    .eq('action', 'UNIT_ALLOCATION')
    .in(
      'order_id',
      activeOrders.map(
        (order) => order.id
      )
    )
    .order('created_at', {
      ascending: false,
    })

  if (allocationLogsError) {
    console.error(
      'GET ALLOCATION LOG ERROR:',
      allocationLogsError
    )
  }

  // ==========================================
  // AMBIL ALOKASI TERBARU PER ORDER
  // ==========================================

  const latestAllocationByOrder =
    new Map<
      string,
      {
        vehicle_type: string
        internal: number
        vendor: number
        unavailable: number
      }[]
    >()

  for (
    const log of allocationLogs || []
  ) {
    if (
      latestAllocationByOrder.has(
        log.order_id
      )
    ) {
      continue
    }

    try {
      const parsed =
        typeof log.new_value === 'string'
          ? JSON.parse(log.new_value)
          : log.new_value

      if (Array.isArray(parsed)) {
        latestAllocationByOrder.set(
          log.order_id,
          parsed
        )
      }
    } catch (error) {
      console.error(
        'PARSE ALLOCATION LOG ERROR:',
        error
      )
    }
  }

  // ==========================================
  // ORDER HISTORY
  // ==========================================

  const {
    data: historyOrders,
    error: historyOrdersError,
  } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      quantity,
      trip,
      status,
      cancel_reason,
      cancelled_at,
      created_at
    `)
    .eq('status', 'cancelled')
    .order('cancelled_at', {
      ascending: false,
    })

  if (historyOrdersError) {
    console.error(
      'GET ORDER HISTORY ERROR:',
      historyOrdersError
    )
  }

  // ==========================================
  // UNIT READY LOADING
  // ==========================================

  const readyUnits =
    activeOrders.flatMap((order) =>
      (order.order_trucks || [])
        .filter(
          (truck) =>
            truck.status ===
            'ready_loading'
        )
        .map((truck) => ({
          ...truck,
          order,
        }))
    )

  // ==========================================
  // UNIT READY TO DEPART
  // ==========================================

  const readyToDepartUnits =
    activeOrders.flatMap((order) =>
      (order.order_trucks || [])
        .filter(
          (truck) =>
            truck.status ===
            'ready_to_depart'
        )
        .map((truck) => ({
          ...truck,
          order,
        }))
    )

  // ==========================================
  // STATISTIK UNIT
  // ==========================================

  const activeTrucks =
    activeOrders.flatMap((order) =>
      (order.order_trucks || [])
        .filter(
          (truck) =>
            truck.status !==
              'cancelled' &&
            truck.status !==
              'departed' &&
            truck.status !==
              'finished' &&
            truck.status !==
              'failed'
        )
    )

  const waitingUnitCount =
    activeOrders.filter(
      (order) =>
        order.status ===
        'waiting_unit'
    ).length

  const waitingHSECount =
    activeTrucks.filter(
      (truck) =>
        truck.status ===
          'waiting_hse' ||
        truck.status ===
          'inspection'
    ).length

  const readyLoadingCount =
    activeTrucks.filter(
      (truck) =>
        truck.status ===
        'ready_loading'
    ).length

  const readyToDepartCount =
    activeTrucks.filter(
      (truck) =>
        truck.status ===
        'ready_to_depart'
    ).length

  const failedCount =
    activeTrucks.filter(
      (truck) =>
        truck.status ===
        'failed'
    ).length

  // ==========================================
  // STATUS LABEL
  // ==========================================

  const getStatusLabel = (
    status: string
  ) => {
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
        return 'Ready Loading'

      case 'ready_to_depart':
        return 'Ready to Depart'

      case 'failed':
        return 'Failed'

      default:
        return status
    }
  }

  const getStatusClass = (
    status: string
  ) => {
    switch (status) {
      case 'waiting_unit':
        return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'

      case 'waiting_hse':
      case 'inspection':
        return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'

      case 'ready_loading':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'

      case 'ready_to_depart':
        return 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200'

      case 'failed':
        return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'

      default:
        return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb]">

      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-8">

        {/* ==========================================
            HEADER
        ========================================== */}

        <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <LayoutDashboard className="h-5 w-5" />
            </div>

            <div>

              <div className="mb-1 flex items-center gap-2">

                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Operational Management
                </span>

              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Operational Control Tower
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Monitor order, unit, pemeriksaan HSE, dan kesiapan keberangkatan.
              </p>

            </div>

          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>

            <div className="text-left">

              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Logged in as
              </p>

              <p className="text-sm font-semibold text-gray-800">
                {user.full_name}
              </p>

            </div>

          </div>

        </div>

        {/* ==========================================
            STATISTIK
        ========================================== */}

        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">

          <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ClipboardList className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-gray-500">
              Waiting Unit
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {waitingUnitCount}
            </p>

          </div>

          <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-gray-500">
              Waiting HSE
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {waitingHSECount}
            </p>

          </div>

          <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <PackageCheck className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-gray-500">
              Ready Loading
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {readyLoadingCount}
            </p>

          </div>

          <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Truck className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-gray-500">
              Ready to Depart
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
              {readyToDepartCount}
            </p>

          </div>

          <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">

            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium text-gray-500">
              Failed
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-red-600">
              {failedCount}
            </p>

          </div>

        </div>

        {/* ==========================================
            SEMUA ORDER AKTIF
        ========================================== */}

        <div className="mb-10">

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                Order Aktif
              </h2>

              <p className="mt-0.5 text-sm text-gray-500">
                Semua order yang masih dalam proses Operational.
              </p>

            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
              {activeOrders.length} Order
            </span>

          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="border-b border-gray-200 bg-gray-50/80">

                  <tr>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      PK / RFT
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Kendaraan
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Quantity
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Unit
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Perubahan
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {activeOrders.map(
                    (order) => {

                      // ==========================================
                      // REQUEST PERUBAHAN PENDING
                      // ==========================================

                      const pendingChangeRequests =
                        order.order_change_requests?.filter(
                          (request) =>
                            request.status ===
                            'pending'
                        ) || []

                      const reduceRequests =
                        pendingChangeRequests.filter(
                          (request) =>
                            request.change_type ===
                            'reduce_unit'
                        )

                      const addRequests =
                        pendingChangeRequests.filter(
                          (request) =>
                            request.change_type ===
                            'add_unit'
                        )

                      // ==========================================
                      // UNIT INTERNAL AKTIF
                      // ==========================================

                      const activeOrderTrucks =
                        order.order_trucks?.filter(
                          (truck) =>
                            truck.source ===
                              'internal' &&
                            truck.status !==
                              'cancelled' &&
                            truck.status !==
                              'departed' &&
                            truck.status !==
                              'finished' &&
                            truck.status !==
                              'failed'
                        ) || []

                      // ==========================================
                      // ALOKASI TERBARU
                      // ==========================================

                      const allocationHistory =
                        latestAllocationByOrder.get(
                          order.id
                        ) || []

                      // ==========================================
                      // INTERNAL DARI ALOKASI
                      // ==========================================

                      const internalAllocated =
                        allocationHistory.reduce(
                          (
                            total,
                            allocation
                          ) =>
                            total +
                            Number(
                              allocation.internal ||
                                0
                            ),
                          0
                        )

                      // ==========================================
                      // VM DARI ALOKASI
                      // ==========================================

                      const vmCount =
                        allocationHistory.reduce(
                          (
                            total,
                            allocation
                          ) =>
                            total +
                            Number(
                              allocation.vendor ||
                                0
                            ),
                          0
                        )

                      // ==========================================
                      // UNAVAILABLE
                      // ==========================================

                      const unavailableCount =
                        allocationHistory.reduce(
                          (
                            total,
                            allocation
                          ) =>
                            total +
                            Number(
                              allocation.unavailable ||
                                0
                            ),
                          0
                        )

                      // ==========================================
                      // JUMLAH INTERNAL
                      //
                      // Kalau detail truck sudah ada,
                      // gunakan jumlah truck aktual.
                      //
                      // Kalau belum ada detail truck,
                      // gunakan hasil allocation.
                      // ==========================================

                      const truckCount =
                        activeOrderTrucks.length >
                        0
                          ? activeOrderTrucks.length
                          : internalAllocated

                      // ==========================================
                      // TOTAL KEBUTUHAN
                      // ==========================================

                      const operationalQuantity =
                        (
                          order.order_requirements ||
                          []
                        ).reduce(
                          (
                            total,
                            requirement
                          ) =>
                            total +
                            Number(
                              requirement.quantity ||
                                0
                            ),
                          0
                        )

                      // ==========================================
                      // RINGKASAN JENIS UNIT INTERNAL
                      // ==========================================

                      const vehicleSummary =
                        activeOrderTrucks.reduce(
                          (
                            result: Record<
                              string,
                              number
                            >,
                            truck
                          ) => {
                            result[
                              truck.vehicle_type
                            ] =
                              (
                                result[
                                  truck
                                    .vehicle_type
                                ] ||
                                0
                              ) + 1

                            return result
                          },
                          {}
                        )

                      const vehicleText =
                        Object.entries(
                          vehicleSummary
                        )
                          .map(
                            ([
                              vehicleType,
                              quantity,
                            ]) =>
                              `${vehicleType} (${quantity})`
                          )
                          .join(', ')

                      return (

                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-gray-50/80"
                        >

                          {/* CUSTOMER */}

                          <td className="px-5 py-4 font-medium text-gray-900">
                            {order.customer}
                          </td>

                          {/* PK / RFT */}

                          <td className="px-5 py-4">

                            <div className="text-gray-900">
                              {order.pk_number ||
                                '-'}
                            </div>

                            <div className="text-xs text-gray-500">
                              {order.rft_tr_job ||
                                '-'}
                            </div>

                          </td>

                          {/* KENDARAAN */}

                          <td className="px-5 py-4 text-gray-600">
                            {vehicleText ||
                              (
                                order.order_requirements ||
                                []
                              )
                                .map(
                                  (
                                    requirement
                                  ) =>
                                    `${requirement.vehicle_type} (${requirement.quantity})`
                                )
                                .join(', ') ||
                              '-'}
                          </td>

                          {/* QUANTITY */}

                          <td className="px-5 py-4">

                            <span className="font-medium text-gray-900">
                              {operationalQuantity}{' '}
                              Unit
                            </span>

                          </td>

                          {/* UNIT AKTUAL */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <div className="flex flex-col gap-1">

                                <div className="flex items-center gap-2">

                                  <span className="font-semibold text-gray-900">
                                    {truckCount +
                                      vmCount}
                                    /
                                    {
                                      operationalQuantity
                                    }
                                  </span>

                                  {vmCount >
                                    0 && (

                                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                                      VM {vmCount}
                                    </span>

                                  )}

                                  {unavailableCount >
                                    0 && (

                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                                      Tidak Tersedia{' '}
                                      {
                                        unavailableCount
                                      }
                                    </span>

                                  )}

                                </div>

                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">

                                  <div
                                    className="h-full rounded-full bg-blue-600"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (
                                          (truckCount +
                                            vmCount) /
                                          Math.max(
                                            operationalQuantity,
                                            1
                                          )
                                        ) *
                                          100
                                      )}%`,
                                    }}
                                  />

                                </div>

                              </div>

                            </div>

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                order.status
                              )}`}
                            >

                              <span className="h-1.5 w-1.5 rounded-full bg-current" />

                              {getStatusLabel(
                                order.status
                              )}

                            </span>

                          </td>

                          {/* PERUBAHAN */}

                          <td className="px-5 py-4">

                            <div className="flex flex-col gap-1.5">

                              {reduceRequests.map(
                                (request) => (

                                  <div
                                    key={
                                      request.id
                                    }
                                  >

                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-100">

                                      <MinusCircle className="h-3 w-3" />

                                      {request.requested_quantity ||
                                        0}{' '}
                                      Unit

                                    </span>

                                    <div className="mt-1 text-[11px] font-medium text-orange-600">
                                      Perlu tindakan
                                    </div>

                                  </div>

                                )
                              )}

                              {addRequests.map(
                                (request) => (

                                  <div
                                    key={
                                      request.id
                                    }
                                  >

                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-100">

                                      <PlusCircle className="h-3 w-3" />

                                      {request.requested_quantity ||
                                        0}{' '}
                                      Unit

                                    </span>

                                    <div className="mt-1 text-[11px] font-medium text-orange-600">
                                      Perlu tindakan
                                    </div>

                                  </div>

                                )
                              )}

                              {!pendingChangeRequests.length && (

                                <span className="text-gray-300">
                                  -
                                </span>

                              )}

                            </div>

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4">

                            <Link
                              href={`/operational/orders/${order.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              Proses
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>

                          </td>

                        </tr>

                      )
                    }
                  )}

                </tbody>

              </table>

              {!activeOrders.length && (

                <div className="flex flex-col items-center gap-3 p-14 text-center">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <Inbox className="h-6 w-6" />
                  </div>

                  <p className="text-sm text-gray-400">
                    Tidak ada order aktif.
                  </p>

                </div>

              )}

            </div>

          </div>

        </div>

        {/* ==========================================
            UNIT SIAP DIPROSES
        ========================================== */}

        <div className="mb-10">

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                Unit Ready Loading
              </h2>

              <p className="mt-0.5 text-sm text-gray-500">
                Unit yang sudah Passed HSE dan
                dapat diproses keberangkatannya.
              </p>

            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {readyUnits.length} Unit
            </span>

          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="border-b border-gray-200 bg-gray-50/80">

                  <tr>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      PK / RFT
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Unit
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      No. Buntut
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Driver
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {readyUnits.map(
                    (truck) => {

                      const order =
                        truck.order

                      return (

                        <tr
                          key={truck.id}
                          className="transition-colors hover:bg-gray-50/80"
                        >

                          <td className="px-5 py-4 font-medium text-gray-900">
                            {order?.customer ||
                              '-'}
                          </td>

                          <td className="px-5 py-4">

                            <div className="text-gray-900">
                              {order?.pk_number ||
                                '-'}
                            </div>

                            <div className="text-xs text-gray-500">
                              {order?.rft_tr_job ||
                                '-'}
                            </div>

                          </td>

                          <td className="px-5 py-4 font-medium text-gray-900">
                            {truck.vehicle_type}
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {truck.no_buntut ||
                              '-'}
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {truck.driver_name ||
                              '-'}
                          </td>

                          <td className="px-5 py-4">

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">

                              <span className="h-1.5 w-1.5 rounded-full bg-current" />

                              Ready Loading

                            </span>

                          </td>

                          <td className="px-5 py-4">

                            <Link
                              href={`/operational/orders/${order.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Proses
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>

                          </td>

                        </tr>

                      )
                    }
                  )}

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

        {/* ==========================================
            UNIT READY TO DEPART
        ========================================== */}

        <div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                Unit Ready to Depart
              </h2>

              <p className="mt-0.5 text-sm text-gray-500">
                Unit yang sudah Passed HSE dan
                Surat Jalan serta Uang Jalan sudah dibagikan.
              </p>

            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
              {readyToDepartUnits.length} Unit
            </span>

          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="border-b border-gray-200 bg-gray-50/80">

                  <tr>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      PK / RFT
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Unit
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      No. Buntut
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Plat
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Driver
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {readyToDepartUnits.map(
                    (truck) => {

                      const order =
                        truck.order

                      return (

                        <tr
                          key={truck.id}
                          className="transition-colors hover:bg-gray-50/80"
                        >

                          <td className="px-5 py-4 font-medium text-gray-900">
                            {order?.customer ||
                              '-'}
                          </td>

                          <td className="px-5 py-4">

                            <div className="text-gray-900">
                              {order?.pk_number ||
                                '-'}
                            </div>

                            <div className="text-xs text-gray-500">
                              {order?.rft_tr_job ||
                                '-'}
                            </div>

                          </td>

                          <td className="px-5 py-4 font-medium text-gray-900">
                            {truck.vehicle_type}
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {truck.no_buntut ||
                              '-'}
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {truck.plate_number ||
                              '-'}
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {truck.driver_name ||
                              '-'}
                          </td>

                          <td className="px-5 py-4">

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">

                              <span className="h-1.5 w-1.5 rounded-full bg-current" />

                              Ready to Depart

                            </span>

                            <div className="mt-1 text-[11px] text-gray-500">
                              SJ + UJ sudah dibagikan
                            </div>

                          </td>

                        </tr>

                      )
                    }
                  )}

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

        {/* ==========================================
            ORDER HISTORY
        ========================================== */}

        <div className="mt-10">

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                Order History
              </h2>

              <p className="mt-0.5 text-sm text-gray-500">
                Riwayat order yang sudah selesai atau dibatalkan.
              </p>

            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200">
              {historyOrders?.length ||
                0}{' '}
              Order
            </span>

          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="border-b border-gray-200 bg-gray-50/80">

                  <tr>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      PK / RFT
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Quantity
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Trip
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Alasan
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Tanggal
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {(historyOrders || []).map(
                    (order) => (

                      <tr
                        key={order.id}
                        className="transition-colors hover:bg-gray-50/80"
                      >

                        <td className="px-5 py-4 font-medium text-gray-900">
                          {order.customer}
                        </td>

                        <td className="px-5 py-4">

                          <div className="text-gray-900">
                            {order.pk_number ||
                              '-'}
                          </div>

                          <div className="text-xs text-gray-500">
                            {order.rft_tr_job ||
                              '-'}
                          </div>

                        </td>

                        <td className="px-5 py-4 font-medium text-gray-900">
                          {order.quantity}{' '}
                          Unit
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {order.trip || '-'}
                        </td>

                        <td className="px-5 py-4">

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">

                            <span className="h-1.5 w-1.5 rounded-full bg-current" />

                            Cancelled

                          </span>

                        </td>

                        <td className="max-w-xs px-5 py-4 text-gray-600">
                          {order.cancel_reason ||
                            '-'}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-gray-500">

                          {order.cancelled_at
                            ? new Date(
                                order.cancelled_at
                              ).toLocaleString(
                                'id-ID'
                              )
                            : '-'}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

              {!historyOrders?.length && (

                <div className="flex flex-col items-center gap-3 p-14 text-center">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <Inbox className="h-6 w-6" />
                  </div>

                  <p className="text-sm text-gray-400">
                    Belum ada order dalam history.
                  </p>

                </div>

              )}

            </div>

          </div>

        </div>

      </div>

    </main>
  )
}