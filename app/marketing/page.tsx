import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import MarketingDashboardPanel from '@/app/marketing/components/marketing-dashboard-panel'

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
    case 'booking_review':
      return 'Booking · Cek Kapasitas'
    case 'booking_confirmed':
      return 'Booking · Mumpuni'
    case 'booking_rejected':
      return 'Booking · Tidak Mumpuni'
    default:
      return status
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'waiting_unit':
      return 'bg-gray-100 text-gray-600'
    case 'waiting_hse':
    case 'inspection':
    case 'ready_loading':
      return 'bg-blue-100 text-blue-700'
    case 'ready_to_depart':
      return 'bg-emerald-100 text-emerald-700'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    case 'booking_review':
      return 'bg-violet-100 text-violet-700'
    case 'booking_confirmed':
      return 'bg-emerald-100 text-emerald-700'
    case 'booking_rejected':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

export default async function MarketingPage() {
  const user = await requireRole(['marketing', 'marketing_admin'])

  const supabase = await createClient()

  const now = new Date()

  const jakartaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const startOfDay = new Date(`${jakartaDate}T00:00:00+07:00`)

  const isMarketingIndividual = user.role === 'marketing'

  // ==========================================
  // ORDER HARI INI + YANG MASIH BELUM KELAR
  // ==========================================

  let todayOrdersQuery = supabase
    .from('orders')
    .select(
      'id, customer, pk_number, rft_tr_job, quantity, trip, status, created_at'
    )
    .or(
      `updated_at.gte.${startOfDay.toISOString()},status.not.in.(ready_to_depart,cancelled)`
    )
    .order('created_at', { ascending: false })

  if (isMarketingIndividual) {
    todayOrdersQuery = todayOrdersQuery.eq('created_by', user.id)
  }

  // ==========================================
  // UNIT PER STATUS — HARUS DIBATASI KE ORDER MILIK SENDIRI
  // ==========================================

  const truckSelect = `
    id,
    order_id,
    vehicle_type,
    no_buntut,
    plate_number,
    driver_name,
    driver_phone,
    status,
    orders!inner (
      customer,
      pk_number,
      rft_tr_job,
      trip,
      created_by
    )
  `

  function scopeToOwner(query: any) {
    if (isMarketingIndividual) {
      return query.eq('orders.created_by', user.id)
    }
    return query
  }

  // todayOrdersQuery dan keempat query truck di bawah ini tidak saling
  // butuh hasil satu sama lain, jadi digabung satu Promise.all.
  const [
    { data: todayOrders, error: todayError },
    { data: waitingHseTrucks, error: waitingHseError },
    { data: readyLoadingTrucks, error: readyLoadingError },
    { data: readyDepartureUnits, error: readyDepartError },
    { data: failedTrucks, error: failedError },
  ] = await Promise.all([
    todayOrdersQuery,
    scopeToOwner(
      supabase.from('order_trucks').select(truckSelect).eq('status', 'waiting_hse')
    ),
    scopeToOwner(
      supabase.from('order_trucks').select(truckSelect).eq('status', 'ready_loading')
    ),
    scopeToOwner(
      supabase
        .from('order_trucks')
        .select(truckSelect)
        .eq('status', 'ready_to_depart')
        .gte('departure_ready_at', startOfDay.toISOString())
        .order('departure_ready_at', { ascending: false })
    ),
    scopeToOwner(
      supabase.from('order_trucks').select(truckSelect).eq('status', 'failed')
    ),
  ])

  if (todayError) console.error('MARKETING TODAY ORDERS ERROR:', todayError)
  if (waitingHseError) console.error('MARKETING WAITING HSE ERROR:', waitingHseError)
  if (readyLoadingError) console.error('MARKETING READY LOADING ERROR:', readyLoadingError)
  if (readyDepartError) console.error('MARKETING READY DEPART ERROR:', readyDepartError)
  if (failedError) console.error('MARKETING FAILED ERROR:', failedError)

  const todayOrderRows = (todayOrders || []).map((order) => ({
    id: order.id,
    customer: order.customer,
    pkNumber: order.pk_number,
    rftTrJob: order.rft_tr_job,
    quantity: order.quantity,
    trip: order.trip,
    statusLabel: getStatusLabel(order.status),
    statusClass: getStatusClass(order.status),
  }))

  function mapTruckRow(truck: any) {
    return {
      id: truck.id,
      orderId: truck.order_id,
      customer: truck.orders?.customer || '-',
      pkNumber: truck.orders?.pk_number || null,
      rftTrJob: truck.orders?.rft_tr_job || null,
      trip: truck.orders?.trip || null,
      vehicleType: truck.vehicle_type,
      noBuntut: truck.no_buntut,
      plateNumber: truck.plate_number,
      driverName: truck.driver_name,
      driverPhone: truck.driver_phone,
    }
  }

  const waitingHseRows = (waitingHseTrucks || []).map(mapTruckRow)
  const readyLoadingRows = (readyLoadingTrucks || []).map(mapTruckRow)
  const readyDepartRows = (readyDepartureUnits || []).map(mapTruckRow)
  const failedRows = (failedTrucks || []).map(mapTruckRow)

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">
          Dashboard Marketing
        </h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Kelola dan monitor permintaan kendaraan.
        </p>
      </div>

      <MarketingDashboardPanel
        todayOrders={todayOrderRows}
        waitingHseUnits={waitingHseRows}
        readyLoadingUnits={readyLoadingRows}
        readyDepartUnits={readyDepartRows}
        failedUnits={failedRows}
      />
    </DashboardShell>
  )
}