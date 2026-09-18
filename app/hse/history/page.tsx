import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import HistorySearchTable from '@/app/hse/components/history-search-table'

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

export default async function HSEHistoryPage() {
  const user = await requireRole(['hse'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      trip,
      status,
      unit_decision,
      created_at,
      order_trucks (
        id,
        vehicle_type,
        source,
        status
      )
    `)
    .neq('status', 'waiting_unit')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET HSE HISTORY ERROR:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (!order.unit_decision) return false

    const internalTrucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal' && truck.status !== 'cancelled'
    )

    const stillWaiting = internalTrucks.some(
      (truck) =>
        truck.status === 'waiting_hse' || truck.status === 'inspection'
    )

    return !stillWaiting
  })

  const historyRows = historyOrders.map((order) => {
    const internalTrucks = (order.order_trucks || []).filter(
      (truck) => truck.source === 'internal' && truck.status !== 'cancelled'
    )

    const vmCount = (order.order_trucks || []).filter(
      (truck) => truck.source === 'vendor' && truck.status !== 'cancelled'
    ).length

    let vehicleSummary = ''
    let resultLabel = ''
    let resultClass = ''

    if (internalTrucks.length === 0) {
      vehicleSummary = 'Full VM (tidak ada unit Internal)'
      resultLabel = 'Full VM — Tidak Perlu HSE'
      resultClass = 'bg-violet-100 text-violet-700'
    } else {
      const counts: Record<string, number> = {}
      for (const truck of internalTrucks) {
        counts[truck.vehicle_type] = (counts[truck.vehicle_type] || 0) + 1
      }
      vehicleSummary = Object.entries(counts)
        .map(([type, count]) => `${type} (${count})`)
        .join(', ')

      const failedCount = internalTrucks.filter(
        (truck) => truck.status === 'failed'
      ).length

      if (failedCount > 0) {
        resultLabel = `${failedCount} Unit Failed`
        resultClass = 'bg-red-100 text-red-700'
      } else {
        resultLabel = 'Semua Passed'
        resultClass = 'bg-emerald-100 text-emerald-700'
      }
    }

    return {
      id: order.id,
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      trip: order.trip,
      vehicleSummary,
      vmCount,
      resultLabel,
      resultClass,
      dateLabel: new Date(order.created_at).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      sortDateIso: order.created_at,
      avatarClass: getAvatarClass(order.customer),
    }
  })

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">
          Inspection History
        </h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Order yang sudah tidak menunggu pemeriksaan HSE lagi — sudah
          selesai diperiksa, atau memang full-VM sehingga tidak pernah
          butuh pemeriksaan.
        </p>
      </div>

      <HistorySearchTable orders={historyRows} />
    </DashboardShell>
  )
}