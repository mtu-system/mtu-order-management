import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import HseDashboardPanel from '@/app/hse/components/hse-dashboard-panel'

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

export default async function HSEPage() {
  const user = await requireRole(['hse'])

  const supabase = await createClient()

  const todayStartIso = getJakartaTodayStartIso()

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
      created_at,
      updated_at,
      order_requirements (
        id,
        vehicle_type,
        quantity
      ),
      order_trucks (
        id,
        vehicle_type,
        no_buntut,
        source,
        status
      )
    `)
    .or(
      `updated_at.gte.${todayStartIso},status.not.in.(ready_to_depart,cancelled)`
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('HSE ORDERS ERROR:', error)
  }

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ]

  const getAvatarClass = (name: string) => {
    const index =
      name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      avatarColors.length
    return avatarColors[index]
  }

  const hseOrderRows = (orders || [])
    .map((order) => {
      const trucks = order.order_trucks || []

      const activeTrucks = trucks.filter(
        (truck) =>
          truck.status !== 'cancelled' && truck.source === 'internal'
      )

      const total = activeTrucks.length

      const passed = activeTrucks.filter(
        (truck) => truck.status === 'ready_loading'
      ).length

      const failed = activeTrucks.filter(
        (truck) => truck.status === 'failed'
      ).length

      const waiting = activeTrucks.filter(
        (truck) =>
          truck.status === 'waiting_hse' || truck.status === 'inspection'
      ).length

      const vehicleCounts: Record<string, number> = {}

      for (const truck of activeTrucks) {
        const vehicleType = truck.vehicle_type || 'Unknown'
        vehicleCounts[vehicleType] = (vehicleCounts[vehicleType] || 0) + 1
      }

      const vehicleSummary = Object.entries(vehicleCounts)
        .map(([vehicleType, count]) => `${vehicleType} (${count})`)
        .join(', ')

      const needsHseAction = waiting > 0 || failed > 0
      const updatedToday = order.updated_at >= todayStartIso

      return {
        id: order.id,
        customer: order.customer,
        avatarClass: getAvatarClass(order.customer),
        pkNumber: order.pk_number,
        rftTrJob: order.rft_tr_job,
        trip: order.trip,
        vehicleSummary,
        total,
        passed,
        waiting,
        failed,
        needsHseAction,
        updatedToday,
      }
    })
    .filter((row) => row.total > 0 && (row.needsHseAction || row.updatedToday))

  return (
    <DashboardShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">HSE Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor pemeriksaan HSE untuk seluruh unit internal.
        </p>
      </div>

      <HseDashboardPanel orders={hseOrderRows} />
    </DashboardShell>
  )
}