import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

import ChangeRequestReview from '@/app/operational/components/change-request-review'
import UnitAllocationForm from '@/app/operational/components/unit-allocation-form'
import UnitDecisionForm from '@/app/operational/components/unit-decision-form'
import TruckDetailForm from '@/app/operational/components/truck-detail-form'
import UnitProcessing from '@/app/operational/components/unit-processing'
import FailedUnitResolution from '@/app/operational/components/failed-unit-resolution'
import VMUnitsPanel from '@/app/components/vm-units-panel'
import OrderHistoryTimeline from '@/app/components/order-history-timeline'

import {
  ArrowLeft,
  FileText,
  Truck,
  ClipboardList,
  StickyNote,
  MessageSquare,
  Gauge,
  PackageCheck,
  PackageSearch,
  History,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'

type Requirement = {
  id: number | string
  vehicle_type: string
  quantity: number
}

type Allocation = {
  vehicle_type: string
  internal: number
  vendor: number
  unavailable: number
}

type TruckData = {
  id: string
  order_id: string
  source: string | null
  vehicle_type: string
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  vendor_name: string | null
  status: string
  ready_loading_by: string | null
  ready_loading_at: string | null
  departure_ready_by: string | null
  departure_ready_at: string | null
  surat_jalan_distributed: boolean | null
  surat_jalan_distributed_by: string | null
  surat_jalan_distributed_at: string | null
  uang_jalan_distributed: boolean | null
  uang_jalan_distributed_by: string | null
  uang_jalan_distributed_at: string | null
  created_at: string
  updated_at: string
}

export default async function OperationalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole(['operational'])
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      order_requirements (
        id,
        vehicle_type,
        quantity
      )
    `)
    .eq('id', id)
    .single()

  if (orderError || !order) {
    notFound()
  }

  const { data: trucks, error: trucksError } = await supabase
    .from('order_trucks')
    .select(`
      id,
      order_id,
      source,
      vehicle_type,
      no_buntut,
      plate_number,
      driver_name,
      driver_phone,
      vendor_name,
      status,
      ready_loading_by,
      ready_loading_at,
      departure_ready_by,
      departure_ready_at,
      surat_jalan_distributed,
      surat_jalan_distributed_by,
      surat_jalan_distributed_at,
      uang_jalan_distributed,
      uang_jalan_distributed_by,
      uang_jalan_distributed_at,
      created_at,
      updated_at
    `)
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  if (trucksError) {
    console.error('GET ORDER TRUCKS ERROR:', trucksError)
  }

  const truckList = (trucks || []) as TruckData[]

  const internalTrucks = truckList.filter(
    (truck) => truck.source === 'internal'
  )

  const requirements = (order.order_requirements || []) as Requirement[]

  const requirementSummary = requirements.reduce(
    (result: Record<string, number>, requirement) => {
      result[requirement.vehicle_type] =
        (result[requirement.vehicle_type] || 0) + Number(requirement.quantity)
      return result
    },
    {}
  )

  const totalRequiredUnits = Object.values(requirementSummary).reduce(
    (total, quantity) => total + quantity,
    0
  )

  const { data: changeRequests, error: changeRequestError } = await supabase
    .from('order_change_requests')
    .select(`
      id,
      change_type,
      requested_quantity,
      requested_vehicle_type,
      requested_value,
      reason,
      status,
      created_at
    `)
    .eq('order_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (changeRequestError) {
    console.error('GET CHANGE REQUEST ERROR:', changeRequestError)
  }

  const { data: allocationLog, error: allocationLogError } = await supabase
    .from('activity_logs')
    .select(`
      id,
      new_value,
      created_at
    `)
    .eq('order_id', id)
    .eq('action', 'UNIT_ALLOCATION')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (allocationLogError) {
    console.error('GET UNIT ALLOCATION ERROR:', allocationLogError)
  }

  let savedAllocations: Allocation[] = []

  if (allocationLog?.new_value) {
    try {
      const parsed =
        typeof allocationLog.new_value === 'string'
          ? JSON.parse(allocationLog.new_value)
          : allocationLog.new_value

      if (Array.isArray(parsed)) {
        savedAllocations = parsed.map((item: Partial<Allocation>) => ({
          vehicle_type: String(item.vehicle_type || ''),
          internal: Number(item.internal || 0),
          vendor: Number(item.vendor || 0),
          unavailable: Number(item.unavailable || 0),
        }))
      }
    } catch (error) {
      console.error('PARSE UNIT ALLOCATION ERROR:', error)
    }
  }

  const hasSavedAllocation =
    savedAllocations.length > 0 ||
    truckList.length > 0 ||
    order.status === 'waiting_hse' ||
    order.status === 'ready_loading'

  const completedInternalTrucks = internalTrucks.filter(
    (truck) =>
      !!truck.plate_number?.trim() &&
      !!truck.driver_name?.trim() &&
      !!truck.driver_phone?.trim()
  )

  const completedInternalByType = completedInternalTrucks.reduce(
    (result: Record<string, number>, truck) => {
      result[truck.vehicle_type] = (result[truck.vehicle_type] || 0) + 1
      return result
    },
    {}
  )

  let remainingInternalRequirements: Requirement[] = []

  if (hasSavedAllocation) {
    remainingInternalRequirements = requirements
      .map((requirement) => {
        const allocation = savedAllocations.find(
          (item) => item.vehicle_type === requirement.vehicle_type
        )

        const internalRequired = Number(allocation?.internal || 0)

        const alreadyCompleted = Number(
          completedInternalByType[requirement.vehicle_type] || 0
        )

        const remaining = Math.max(0, internalRequired - alreadyCompleted)

        return { ...requirement, quantity: remaining }
      })
      .filter((requirement) => requirement.quantity > 0)
  }

  const historyInternalTrucks = completedInternalTrucks

  const totalInternalRequired = savedAllocations.reduce(
    (total, allocation) => total + Number(allocation.internal || 0),
    0
  )

  const totalInternalCompleted = historyInternalTrucks.length

  const totalInternalRemaining = remainingInternalRequirements.reduce(
    (total, requirement) => total + Number(requirement.quantity),
    0
  )

  const showTruckDetail = hasSavedAllocation && totalInternalRemaining > 0

  const readyLoadingTrucks = internalTrucks.filter(
    (truck) => truck.status === 'ready_loading'
  )

  const readyToDepartTrucks = internalTrucks.filter(
    (truck) => truck.status === 'ready_to_depart'
  )

  const failedTrucks = internalTrucks.filter(
    (truck) => truck.status === 'failed'
  )

  const hasAllInternalDetails =
    hasSavedAllocation &&
    totalInternalRequired > 0 &&
    totalInternalCompleted >= totalInternalRequired

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="mb-8 border-b border-gray-100 pb-6">
          <Link
            href="/operational"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Control Tower
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#01236A] text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Detail Order
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Monitor dan proses setiap unit dalam order.
              </p>
            </div>
          </div>
        </div>

        {/* INFORMASI ORDER */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
            <ClipboardList className="h-4.5 w-4.5 text-gray-400" />
            Informasi Order
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Customer
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {order.customer}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nomor PK
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {order.pk_number}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                RFT / TR / Job
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {order.rft_tr_job || '-'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Trip
              </p>
              <p className="mt-1.5 font-bold text-gray-900">{order.trip}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Status Order
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                {order.status}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Dibuat Oleh
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {order.created_by === user.id ? 'Anda' : order.created_by}
              </p>
            </div>
          </div>
        </div>

        {/* KEBUTUHAN KENDARAAN */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
              <Truck className="h-4.5 w-4.5 text-gray-400" />
              Kebutuhan Kendaraan
            </h2>
            <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
              Total {totalRequiredUnits} Unit
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Jenis Kendaraan
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Kebutuhan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(requirementSummary).map(
                  ([vehicleType, quantity], index) => (
                    <tr key={vehicleType}>
                      <td className="px-4 py-3 text-gray-600">{index + 1}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {vehicleType}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {quantity} Unit
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
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
              <MessageSquare className="h-4.5 w-4.5 text-gray-400" />
              Instruksi
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {order.instruction || '-'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
              <StickyNote className="h-4.5 w-4.5 text-gray-400" />
              Catatan
            </h2>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {order.notes || '-'}
            </p>
          </div>
        </div>

        {/* KEPUTUSAN UNIT */}
        {!order.unit_decision && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">
              Keputusan Unit
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Tentukan ketersediaan unit untuk order ini.
            </p>
            <UnitDecisionForm orderId={order.id} />
          </div>
        )}

        {/* ALOKASI UNIT */}
        {!hasSavedAllocation && order.unit_decision === 'available' && (
          <UnitAllocationForm orderId={order.id} requirements={requirements} />
        )}

        {/* RINGKASAN ALOKASI */}
        {hasSavedAllocation && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
                <Truck className="h-4.5 w-4.5 text-gray-400" />
                Alokasi Unit
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Pembagian unit berdasarkan hasil keputusan Operational.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Jenis Unit
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Kebutuhan
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Internal
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      VM
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tidak Tersedia
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {savedAllocations.map((allocation) => (
                    <tr key={allocation.vehicle_type}>
                      <td className="px-4 py-4 font-bold text-gray-900">
                        {allocation.vehicle_type}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-600">
                        {getRequirementQuantity(
                          requirements,
                          allocation.vehicle_type
                        )}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-[#01236A]">
                        {allocation.internal}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-violet-600">
                        {allocation.vendor}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-gray-500">
                        {allocation.unavailable}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY INTERNAL */}
        {historyInternalTrucks.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
                  <History className="h-4.5 w-4.5 text-gray-400" />
                  History Unit Internal
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Unit internal yang sudah diinformasikan oleh Operational.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
                {historyInternalTrucks.length} Unit
              </span>
            </div>

            <div className="space-y-3">
              {historyInternalTrucks.map((truck, index) => (
                <div
                  key={truck.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#01236A]/10 text-xs font-bold text-[#01236A]">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">
                          {truck.vehicle_type}
                        </p>
                        <p className="text-sm text-gray-600">
                          {truck.plate_number || '-'}
                          {' · '}
                          {truck.driver_name || '-'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          HP: {truck.driver_phone || '-'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A]/10 px-3 py-1 text-xs font-bold text-[#01236A]">
                      <ShieldCheck className="h-3 w-3" />
                      {truck.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FORM DETAIL INTERNAL YANG MASIH KURANG */}
        {showTruckDetail && (
          <TruckDetailForm
            orderId={order.id}
            requirements={remainingInternalRequirements}
          />
        )}

        {/* SEMUA INTERNAL SUDAH LENGKAP */}
        {hasAllInternalDetails && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-emerald-900">
                  Detail seluruh unit internal sudah lengkap
                </p>
                <p className="mt-0.5 text-sm text-emerald-700">
                  {totalInternalCompleted} unit internal sudah diinformasikan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UNIT VENDOR / VM (READ ONLY, SHARED) */}
        <VMUnitsPanel orderId={order.id} />

        {/* REQUEST PERUBAHAN MARKETING */}
        {changeRequests && changeRequests.length > 0 && (
          <div className="mb-6 space-y-4">
            {changeRequests.map((request) => (
              <ChangeRequestReview
                key={request.id}
                orderId={order.id}
                request={request}
                trucks={truckList}
              />
            ))}
          </div>
        )}

        {/* STATUS INTERNAL */}
        {hasSavedAllocation && totalInternalRequired > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
                <Gauge className="h-4.5 w-4.5 text-gray-400" />
                Status Unit Internal
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Status unit internal diproses secara terpisah. Unit VM
                tidak masuk perhitungan HSE.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Internal
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  {totalInternalRequired}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Lengkap
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#01236A]">
                  {totalInternalCompleted}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Menunggu SJ/UJ
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                  {readyLoadingTrucks.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ready to Depart
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-violet-600">
                  {readyToDepartTrucks.length}
                </p>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Failed
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-red-600">
                  {failedTrucks.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UNIT GAGAL HSE */}
        {failedTrucks.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
                Unit Gagal HSE
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Pilih tindakan untuk unit yang tidak lolos pemeriksaan HSE.
              </p>
            </div>

            <div className="space-y-3">
              {failedTrucks.map((truck) => (
                <FailedUnitResolution
                  key={truck.id}
                  truck={{
                    id: truck.id,
                    order_id: truck.order_id,
                    vehicle_type: truck.vehicle_type,
                    plate_number: truck.plate_number,
                    driver_name: truck.driver_name,
                    driver_phone: truck.driver_phone,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* UNIT SIAP DIPROSES */}
        {readyLoadingTrucks.length > 0 && (
          <div className="mb-6">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
                <PackageCheck className="h-4.5 w-4.5 text-gray-400" />
                Unit Siap Diproses
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Unit yang sudah Passed HSE dapat langsung diproses.
              </p>
            </div>

            <div className="space-y-5">
              {readyLoadingTrucks.map((truck) => (
                <UnitProcessing
                  key={truck.id}
                  truck={{
                    id: truck.id,
                    order_id: truck.order_id,
                    vehicle_type: truck.vehicle_type,
                    no_buntut: truck.no_buntut,
                    plate_number: truck.plate_number,
                    driver_name: truck.driver_name,
                    driver_phone: truck.driver_phone,
                    status: truck.status,
                    surat_jalan_distributed:
                      truck.surat_jalan_distributed ?? false,
                    uang_jalan_distributed:
                      truck.uang_jalan_distributed ?? false,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* UNIT READY TO DEPART */}
        {readyToDepartTrucks.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
              <Truck className="h-4.5 w-4.5 text-gray-400" />
              Unit Ready to Depart
            </h2>

            <div className="space-y-3">
              {readyToDepartTrucks.map((truck, index) => (
                <div
                  key={truck.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4"
                >
                  <div>
                    <p className="font-bold text-gray-900">
                      Unit {index + 1} — {truck.vehicle_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      {truck.plate_number || '-'}
                      {' · '}
                      {truck.driver_name || '-'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                    Ready to Depart
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BELUM ADA UNIT PASSED */}
        {hasSavedAllocation &&
          totalInternalRequired > 0 &&
          readyLoadingTrucks.length === 0 &&
          readyToDepartTrucks.length === 0 &&
          failedTrucks.length === 0 && (
            <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <PackageSearch className="h-6 w-6" />
              </div>
              <p className="font-bold text-gray-900">
                Belum ada unit yang Passed HSE.
              </p>
              <p className="text-sm text-gray-500">
                Unit akan muncul di sini satu per satu setelah HSE
                menyatakan Passed.
              </p>
            </div>
          )}

        {/* RIWAYAT UNIT & ORDER */}
        <OrderHistoryTimeline orderId={order.id} />
      </div>
    </main>
  )
}

function getRequirementQuantity(
  requirements: Requirement[],
  vehicleType: string
) {
  return requirements
    .filter((item) => item.vehicle_type === vehicleType)
    .reduce((total, item) => total + Number(item.quantity), 0)
}