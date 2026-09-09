import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import { History as HistoryIcon, PlusCircle } from 'lucide-react'
import OrdersTable from '@/app/marketing/components/orders-table'

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

export default async function MarketingOrdersPage() {
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
      vehicle_type,
      quantity,
      trip,
      status,
      created_at,
      reduce_unit_requested,
      reduce_unit_quantity,
      reduce_unit_vehicle_type,
      order_trucks (
        id,
        vehicle_type,
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
    console.error('Failed to fetch orders:', error)
  }

  const activeOrders = (orders || []).filter((order) => {
    if (order.status === 'cancelled') return false
    if (order.status === 'pending') return false
    if (order.status === 'ready_to_depart') return false

    if (order.status === 'ready_loading') {
      const internalTrucks = (order.order_trucks || []).filter(
        (truck) =>
          truck.source === 'internal' && truck.status !== 'cancelled'
      )
      if (internalTrucks.length === 0) return false
    }

    return true
  })

  const orderRows = activeOrders.map((order) => {
    const activeTrucks =
      order.order_trucks?.filter(
        (truck) =>
          truck.status !== 'cancelled' &&
          truck.status !== 'departed' &&
          truck.status !== 'finished' &&
          truck.status !== 'failed'
      ) || []

    const vehicleSummary = activeTrucks.reduce(
      (result: Record<string, number>, truck) => {
        result[truck.vehicle_type] = (result[truck.vehicle_type] || 0) + 1
        return result
      },
      {}
    )

    const vehicleText = Object.entries(vehicleSummary)
      .map(([vehicleType, quantity]) => `${vehicleType} (${quantity})`)
      .join(', ')

    const internalTrucks = activeTrucks.filter(
      (truck) => truck.source === 'internal'
    )

    const readyToDepartCount = internalTrucks.filter(
      (truck) => truck.status === 'ready_to_depart'
    ).length

    const readyLoadingCount = internalTrucks.filter(
      (truck) => truck.status === 'ready_loading'
    ).length

    const waitingHseCount = internalTrucks.filter(
      (truck) =>
        truck.status === 'waiting_hse' || truck.status === 'inspection'
    ).length

    const vmCount = activeTrucks.filter(
      (truck) => truck.source === 'vendor'
    ).length

    return {
      id: order.id,
      customer: order.customer,
      pkNumber: order.pk_number,
      rftTrJob: order.rft_tr_job,
      orderType: order.order_type,
      vehicleText,
      activeQuantity: activeTrucks.length,
      internalCount: internalTrucks.length,
      readyToDepartCount,
      readyLoadingCount,
      waitingHseCount,
      vmCount,
      trip: order.trip,
      status: order.status,
      avatarClass: getAvatarClass(order.customer),
      reduceUnitRequested: order.reduce_unit_requested || false,
      reduceUnitQuantity: order.reduce_unit_quantity,
      reduceUnitVehicleType: order.reduce_unit_vehicle_type,
    }
  })

  return (
    <DashboardShell user={user}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Order aktif yang dibuat oleh Marketing.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/marketing/orders/history"
            className="inline-flex items-center gap-2 rounded-lg border border-[#01236A]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#01236A] shadow-sm transition hover:bg-[#01236A]/5"
          >
            <HistoryIcon className="h-4 w-4" />
            Order History
          </Link>

          <Link
            href="/marketing/orders/create"
            className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#01236A]/85"
          >
            <PlusCircle className="h-4 w-4" />
            Create Order
          </Link>
        </div>
      </div>

      <OrdersTable orders={orderRows} />
    </DashboardShell>
  )
}