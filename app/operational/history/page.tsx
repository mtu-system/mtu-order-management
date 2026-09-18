import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import HistorySearchTable from '@/app/operational/components/history-search-table'

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

export default async function OperationalHistoryPage() {
  const user = await requireRole(['operational'])

  const supabase = await createClient()

  const { data: orders, error } = await supabase
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
      decision_note,
      created_at,
      order_trucks (
        id,
        vehicle_type,
        source,
        status,
        no_buntut,
        plate_number,
        driver_name
      )
    `)
    .in('status', ['cancelled', 'ready_to_depart', 'ready_loading', 'pending'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET OPERATIONAL HISTORY ERROR:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return true
    if (order.status === 'ready_to_depart') return true
    if (order.status === 'pending') return true

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      return internalTrucks.length === 0
    }

    return false
  })

  const getReasonLabel = (order: (typeof historyOrders)[number]) => {
    if (order.status === 'cancelled') return order.cancel_reason || '-'
    if (order.status === 'pending')
      return (
        order.decision_note ||
        'Unit Tidak Tersedia — menunggu tindakan Marketing'
      )
    if (order.status === 'ready_to_depart')
      return 'Selesai — semua unit Ready to Depart'
    return 'Selesai — dipenuhi Vendor / VM'
  }

  const historyRows = historyOrders.map((order) => {
    const trucks = (order.order_trucks || []).filter(
      (truck) => truck.status !== 'cancelled'
    )

    const internalCount = trucks.filter(
      (truck) => truck.source === 'internal'
    ).length

    const vmCount = trucks.filter((truck) => truck.source === 'vendor').length

    const sortDate = order.cancelled_at || order.created_at

    return {
      id: order.id,
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      quantity: order.quantity,
      trip: order.trip,
      status: order.status,
      reasonLabel: getReasonLabel(order),
      dateLabel: new Date(sortDate).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      sortDateIso: sortDate,
      internalCount,
      vmCount,
      avatarClass: getAvatarClass(order.customer),
      units: order.order_trucks || [],
    }
  })

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Order History</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Order yang sudah tidak butuh tindakan lagi dari Operational —
          selesai, Ready to Depart, dibatalkan, Unit Tidak Tersedia, atau
          full-VM.
        </p>
      </div>

      <HistorySearchTable orders={historyRows} />
    </DashboardShell>
  )
}