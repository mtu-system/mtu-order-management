import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import BookingReportTable from '@/app/manager/components/booking-report-table'

export default async function BookingReportPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      quantity,
      status,
      booking_date,
      booking_decision,
      booking_decision_note,
      booking_decided_by,
      booking_decided_at,
      created_at,
      order_requirements (
        vehicle_type,
        quantity
      )
    `)
    .eq('is_booking', true)
    .order('booking_date', { ascending: false })

  if (error) {
    console.error('BOOKING REPORT ERROR:', error)
  }

  const rows = orders || []

  const deciderIds = Array.from(
    new Set(rows.map((row) => row.booking_decided_by).filter(Boolean))
  ) as string[]

  let deciderNames: Record<string, string> = {}

  if (deciderIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', deciderIds)

    deciderNames = Object.fromEntries(
      (profiles || []).map((profile) => [
        profile.id,
        profile.full_name || 'User',
      ])
    )
  }

  // Ambil breakdown internal/vendor dari activity_logs (BOOKING_CAPACITY_CHECK),
  // satu log per order -- yang terbaru.
  const orderIds = rows.map((row) => row.id)

  let breakdownByOrder: Record<
    string,
    { vehicle_type: string; internal: number; vendor: number; unavailable: number }[]
  > = {}

  if (orderIds.length) {
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('order_id, new_value, created_at')
      .eq('action', 'BOOKING_CAPACITY_CHECK')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })

    for (const log of logs || []) {
      if (breakdownByOrder[log.order_id]) continue

      try {
        const parsed =
          typeof log.new_value === 'string'
            ? JSON.parse(log.new_value)
            : log.new_value

        if (Array.isArray(parsed)) {
          breakdownByOrder[log.order_id] = parsed
        }
      } catch (parseError) {
        console.error('PARSE BOOKING CAPACITY LOG ERROR:', parseError)
      }
    }
  }

  function resultOf(status: string) {
    if (status === 'waiting_unit' || status === 'waiting_hse' ||
        status === 'inspection' || status === 'ready_loading' ||
        status === 'ready_to_depart' || status === 'driver_started') {
      return 'activated' as const
    }
    if (status === 'booking_rejected') return 'rejected' as const
    if (status === 'cancelled') return 'cancelled' as const
    if (status === 'booking_confirmed') return 'confirmed' as const
    return 'review' as const
  }

  const reportRows = rows.map((row) => {
    const requirements = (row.order_requirements || []) as {
      vehicle_type: string
      quantity: number
    }[]

    const totalQuantity = requirements.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    )

    return {
      id: row.id,
      customer: row.customer,
      pkNumber: row.pk_number,
      rftTrJob: row.rft_tr_job,
      bookingDate: row.booking_date,
      totalQuantity: totalQuantity || row.quantity || 0,
      requirements,
      status: row.status,
      result: resultOf(row.status),
      decision: row.booking_decision as
        | 'available'
        | 'partial'
        | 'unavailable'
        | null,
      decisionNote: row.booking_decision_note,
      decidedByName: row.booking_decided_by
        ? deciderNames[row.booking_decided_by] || 'User'
        : '-',
      decidedAt: row.booking_decided_at,
      breakdown: breakdownByOrder[row.id] || [],
    }
  })

  const activatedCount = reportRows.filter(
    (row) => row.result === 'activated'
  ).length
  const rejectedCount = reportRows.filter(
    (row) => row.result === 'rejected' || row.result === 'cancelled'
  ).length
  const reviewCount = reportRows.filter(
    (row) => row.result === 'review' || row.result === 'confirmed'
  ).length

  return (
    <DashboardShell user={user}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Booking Report</h1>
          <p className="text-xs text-gray-500">
            Rekap booking kebutuhan masa depan dari Marketing — berapa yang
            bisa dicover MTU (diambil) dan berapa yang tidak, buat lihat
            kapasitas MTU dari waktu ke waktu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            {activatedCount} Diambil
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
            {rejectedCount} Tidak Diambil
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
            {reviewCount} Masih Proses
          </span>
        </div>
      </div>

      <BookingReportTable rows={reportRows} />
    </DashboardShell>
  )
}
