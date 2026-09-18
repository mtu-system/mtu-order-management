import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import OrderHistoryTimeline from '@/app/components/order-history-timeline'
import { ArrowLeft, Truck as TruckIcon, FileText } from 'lucide-react'

type Requirement = {
  id: string
  vehicle_type: string
  quantity: number
}

type TruckRow = {
  id: string
  source: string | null
  vehicle_type: string
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  vendor_name: string | null
  status: string
  surat_jalan_distributed: boolean | null
  uang_jalan_distributed: boolean | null
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'waiting_unit':
      return 'Waiting Unit'
    case 'waiting_hse':
      return 'Waiting HSE'
    case 'inspection':
      return 'Inspection'
    case 'ready_loading':
      return 'Menunggu SJ/UJ'
    case 'ready_to_depart':
      return 'Ready to Depart'
    case 'pending':
      return 'Unit Tidak Tersedia'
    case 'cancelled':
      return 'Cancelled'
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
    case 'pending':
      return 'bg-gray-200 text-gray-700'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getTruckStatusLabel(status: string) {
  switch (status) {
    case 'vm':
      return 'VM / Vendor '
    case 'waiting_hse':
      return 'Waiting HSE'
    case 'ready_loading':
      return 'Menunggu SJ/UJ'
    case 'ready_to_depart':
      return 'Ready to Depart'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

export default async function ManagerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireRole(['manager'])
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
      source,
      vehicle_type,
      no_buntut,
      plate_number,
      driver_name,
      driver_phone,
      vendor_name,
      status,
      surat_jalan_distributed,
      uang_jalan_distributed
    `)
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  if (trucksError) {
    console.error('MANAGER ORDER TRUCKS ERROR:', trucksError)
  }

  const requirements = (order.order_requirements || []) as Requirement[]
  const truckList = (trucks || []) as TruckRow[]

  const dateLabel = new Date(order.created_at).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <DashboardShell user={user}>
      <Link
        href="/manager/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Kembali ke Orders
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {order.customer}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Dibuat {dateLabel}
            {order.trip ? ` · Trip: ${order.trip}` : ''}
          </p>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
            order.status
          )}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
            <FileText className="h-4 w-4 text-gray-400" />
            Info Order
          </h2>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Nomor PK
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                {order.pk_number || '-'}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                RFT / TR / Job
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                {order.rft_tr_job || '-'}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Quantity
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                {order.quantity} Unit
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Jenis Kendaraan
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                {order.vehicle_type || '-'}
              </dd>
            </div>

            {order.instruction && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Instruksi
                </dt>
                <dd className="mt-0.5 text-sm text-gray-700">
                  {order.instruction}
                </dd>
              </div>
            )}

            {order.notes && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Catatan
                </dt>
                <dd className="mt-0.5 text-sm text-gray-700">
                  {order.notes}
                </dd>
              </div>
            )}

            {order.unit_decision && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Keputusan Unit
                </dt>
                <dd className="mt-0.5 text-sm text-gray-700">
                  {order.unit_decision}
                  {order.decision_note ? ` — ${order.decision_note}` : ''}
                </dd>
              </div>
            )}

            {order.status === 'cancelled' && order.cancel_reason && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                  Alasan Dibatalkan
                </dt>
                <dd className="mt-0.5 text-sm text-red-700">
                  {order.cancel_reason}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-900">
            Kebutuhan Unit
          </h2>

          {requirements.length ? (
            <ul className="space-y-2.5">
              {requirements.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-gray-700">
                    {req.vehicle_type}
                  </span>
                  <span className="font-bold text-gray-900">
                    {req.quantity} Unit
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">Belum ada kebutuhan unit.</p>
          )}
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <TruckIcon className="h-4 w-4 text-gray-400" />
            Unit
          </h2>
          <span className="text-xs font-semibold text-gray-400">
            {truckList.length} unit
          </span>
        </div>

        {truckList.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Unit
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Sumber
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Driver
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    SJ / UJ
                  </th>
                  <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {truckList.map((truck) => (
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
                      {truck.source === 'vendor'
                        ? truck.vendor_name || 'Vendor'
                        : 'Internal'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-700">
                      {truck.driver_name || '-'}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">
                      {truck.surat_jalan_distributed ? 'SJ ✓' : 'SJ -'}
                      {' / '}
                      {truck.uang_jalan_distributed ? 'UJ ✓' : 'UJ -'}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                        {getTruckStatusLabel(truck.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-4 text-sm text-gray-400">
            Belum ada unit yang dialokasikan.
          </div>
        )}
      </div>

      <OrderHistoryTimeline orderId={order.id} />
    </DashboardShell>
  )
}