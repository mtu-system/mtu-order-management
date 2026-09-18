import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import OrderHistoryTable from '@/app/marketing/components/order-history-table'

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

export default async function MarketingOrderHistoryPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])

  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(`
      id,
      customer,
      rft_tr_job,
      pk_number,
      order_type,
      quantity,
      trip,
      status,
      cancel_reason,
      cancelled_at,
      created_at,
      order_trucks (
        id,
        source,
        status
      )
    `)
    .order('created_at', { ascending: false })

  if (user.role === 'marketing') {
    query = query.eq('created_by', user.id)
  }

  const { data: orders, error } = await query

  if (error) {
    console.error('Failed to fetch order history:', error)
  }

  const historyOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return true
    if (order.status === 'pending') return true
    if (order.status === 'ready_to_depart') return true

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      return internalTrucks.length === 0
    }

    return false
  })

  const historyRows = historyOrders.map((order) => {
    const trucks = (order.order_trucks || []).filter(
      (truck) => truck.status !== 'cancelled'
    )

    const internalCount = trucks.filter(
      (truck) => truck.source === 'internal'
    ).length

    const vmCount = trucks.filter((truck) => truck.source === 'vendor').length

    const reasonLabel =
      order.status === 'cancelled'
        ? order.cancel_reason || '-'
        : order.status === 'pending'
        ? 'Unit Tidak Tersedia — menunggu tindakan Marketing'
        : order.status === 'ready_to_depart'
        ? 'Selesai — semua unit Ready to Depart'
        : 'Selesai — dipenuhi Vendor / VM'

       const sortDate = order.cancelled_at || order.created_at

    const dateLabel = new Date(sortDate).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return {
      id: order.id,
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      orderType: order.order_type,
      quantity: order.quantity,
      trip: order.trip,
      status: order.status,
      reasonLabel,
      dateLabel,
      sortDateIso: sortDate,
      internalCount,
      vmCount,
      avatarClass: getAvatarClass(order.customer),
    }
  })

  return (
    <DashboardShell user={user}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Order History</h1>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Order yang sudah selesai, Ready to Depart, dibatalkan, atau Unit
            Tidak Tersedia.
          </p>
        </div>
      </div>

      <OrderHistoryTable orders={historyRows} />
    </DashboardShell>
  )
}