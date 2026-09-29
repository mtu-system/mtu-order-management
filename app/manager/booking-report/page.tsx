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
      cancel_reason,
      cancelled_by,
      cancelled_at,
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

  const peopleIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.booking_decided_by, row.cancelled_by])
    ).values()
  ).filter(Boolean) as string[]

  let peopleNames: Record<string, { name: string; role: string }> = {}

  if (peopleIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', peopleIds)

    const roleLabels: Record<string, string> = {
      manager: 'Manager',
      marketing: 'Marketing',
      marketing_admin: 'Marketing',
      operational: 'Operational',
      hse: 'HSE',
      vm: 'VM',
    }

    peopleNames = Object.fromEntries(
      (profiles || []).map((profile) => [
        profile.id,
        {
          name: profile.full_name || 'User',
          role: roleLabels[profile.role] || profile.role,
        },
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

  function resultOf(
    status: string,
    bookingDecision: string | null
  ) {
    if (status === 'waiting_unit' || status === 'waiting_hse' ||
        status === 'inspection' || status === 'ready_loading' ||
        status === 'ready_to_depart' || status === 'driver_started') {
      return 'activated' as const
    }
    if (status === 'booking_rejected') return 'rejected' as const
    if (status === 'cancelled') {
      // Dibatalkan setelah Operational bilang tidak/sebagian mumpuni --
      // akar masalahnya di kapasitas, Marketing cuma menutup booking-nya.
      if (bookingDecision === 'unavailable' || bookingDecision === 'partial') {
        return 'cancelled_ops' as const
      }
      // Ops sudah bilang mumpuni (atau belum pernah dicek), tapi Marketing
      // tetap memilih membatalkan -- ini murni keputusan Marketing.
      return 'cancelled_marketing' as const
    }
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
      result: resultOf(row.status, row.booking_decision),
      decision: row.booking_decision as
        | 'available'
        | 'partial'
        | 'unavailable'
        | null,
      decisionNote: row.booking_decision_note,
      decidedByName: row.booking_decided_by
        ? peopleNames[row.booking_decided_by]?.name || 'User'
        : '-',
      decidedAt: row.booking_decided_at,
      cancelReason: row.cancel_reason,
      cancelledByName: row.cancelled_by
        ? peopleNames[row.cancelled_by]?.name || 'User'
        : null,
      cancelledByRole: row.cancelled_by
        ? peopleNames[row.cancelled_by]?.role || null
        : null,
      cancelledAt: row.cancelled_at,
      breakdown: breakdownByOrder[row.id] || [],
    }
  })

  const activatedCount = reportRows.filter(
    (row) => row.result === 'activated'
  ).length
  const rejectedCount = reportRows.filter((row) =>
    ['rejected', 'cancelled_ops', 'cancelled_marketing'].includes(row.result)
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