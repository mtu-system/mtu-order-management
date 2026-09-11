import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import RejectReportTable from '@/app/manager/components/reject-report-table'

export default async function RejectReportPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      customer,
      pk_number,
      rft_tr_job,
      order_type,
      quantity,
      unit_decision,
      decision_note,
      decided_by,
      decided_at,
      order_requirements (
        vehicle_type,
        quantity
      )
    `)
    .in('unit_decision', ['partial', 'unavailable'])
    .order('decided_at', { ascending: false })

  if (error) {
    console.error('REJECT REPORT ERROR:', error)
  }

  const rows = orders || []

  const deciderIds = Array.from(
    new Set(rows.map((row) => row.decided_by).filter(Boolean))
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

  const reportRows = rows.map((row) => ({
    id: row.id,
    customer: row.customer,
    pkNumber: row.pk_number,
    rftTrJob: row.rft_tr_job,
    orderType: row.order_type,
    quantity: row.quantity,
    decision: row.unit_decision as 'partial' | 'unavailable',
    decisionNote: row.decision_note,
    decidedByName: row.decided_by
      ? deciderNames[row.decided_by] || 'User'
      : '-',
    decidedAt: row.decided_at,
    requirements: (row.order_requirements || []) as {
      vehicle_type: string
      quantity: number
    }[],
  }))

  const partialCount = reportRows.filter(
    (row) => row.decision === 'partial'
  ).length
  const unavailableCount = reportRows.filter(
    (row) => row.decision === 'unavailable'
  ).length

  return (
    <DashboardShell user={user}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reject Report</h1>
          <p className="text-xs text-gray-500">
            Order yang unitnya sebagian atau seluruhnya tidak tersedia,
            berdasarkan keputusan Operational.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
            {partialCount} Sebagian Tersedia
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
            {unavailableCount} Tidak Tersedia
          </span>
        </div>
      </div>

      <RejectReportTable rows={reportRows} />
    </DashboardShell>
  )
}