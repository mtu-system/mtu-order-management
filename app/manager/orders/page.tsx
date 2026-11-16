import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { fetchAll } from '@/lib/fetch-all'
import { createClient } from '@/lib/supabase/server'
import OrdersSearchTable from '@/app/manager/components/orders-search-table'
export const dynamic = 'force-dynamic'

const HISTORY_WINDOW_DAYS = 90

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

export default async function ManagerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; all?: string }>
}) {
  const user = await requireRole(['manager'])
  const { status, all } = await searchParams
  const showAllHistory = all === '1'

  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      trip,
      quantity,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (!showAllHistory) {
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - HISTORY_WINDOW_DAYS)
    query = query.gte('created_at', windowStart.toISOString())
  }

  const { rows: orders, error } = await fetchAll((from, to) =>
    query.range(from, to)
  )

  if (error) {
    console.error('MANAGER ORDERS LIST ERROR:', error)
  }

  const orderRows = (orders || []).map((order) => ({
    id: order.id,
    customer: order.customer,
    pkNumber: order.pk_number,
    rftTrJob: order.rft_tr_job,
    quantity: order.quantity,
    trip: order.trip,
    status: order.status,
    statusLabel: getStatusLabel(order.status),
    statusClass: getStatusClass(order.status),
    dateLabel: new Date(order.created_at).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    sortDateIso: order.created_at,
    avatarClass: getAvatarClass(order.customer),
  }))

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Orders"
        subtitle="Semua order dalam sistem — read only monitoring."
      >
        <span className="rounded-md bg-[#2563EB]/10 px-2.5 py-1 text-xs font-bold text-[#2563EB]">
        {orderRows.length} Order
        </span>
      </PageHeader>

      <p className="mb-4 text-xs text-gray-500">
        {showAllHistory ? (
          <>
            Menampilkan seluruh riwayat order.{' '}
            <Link
              href={status ? `/manager/orders?status=${status}` : '/manager/orders'}
              className="font-semibold text-[#2563EB] hover:underline"
            >
              Kembali ke {HISTORY_WINDOW_DAYS} hari terakhir
            </Link>
          </>
        ) : (
          <>
            Menampilkan order {HISTORY_WINDOW_DAYS} hari terakhir.{' '}
            <Link
              href={
                status
                  ? `/manager/orders?status=${status}&all=1`
                  : '/manager/orders?all=1'
              }
              className="font-semibold text-[#2563EB] hover:underline"
            >
              Tampilkan semua riwayat
            </Link>
          </>
        )}
      </p>

      <OrdersSearchTable orders={orderRows} initialStatus={status} />
    </DashboardShell>
  )
}