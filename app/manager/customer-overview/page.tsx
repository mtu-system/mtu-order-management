import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import CustomerRankingTable from '@/app/manager/components/customer-ranking-table'
import PeriodSwitcher from '@/app/components/period-switcher'
import { fetchAll } from '@/lib/fetch-all'
import { resolvePeriod } from '@/lib/period'

export default async function CustomerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>
}) {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { bulan } = await searchParams
  const period = resolvePeriod(bulan)

  const query = supabase
    .from('orders')
    .select('id, customer, created_at, unit_decision')
    .gte('created_at', period.startIso)
    .lt('created_at', period.endIso)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const { rows: orders, error, truncated } = await fetchAll((from, to) =>
    query.range(from, to)
  )

  if (error) {
    console.error('CUSTOMER OVERVIEW ERROR:', error)
  }

  const rows = orders.map((order) => ({
    id: order.id,
    customer: order.customer,
    createdAt: order.created_at,
    isRejected:
      order.unit_decision === 'partial' ||
      order.unit_decision === 'unavailable',
  }))

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Customer Overview"
        subtitle="Ringkasan jumlah order dan reject per customer."
      />

      <PeriodSwitcher period={period} count={rows.length} truncated={truncated} />

      <CustomerRankingTable rows={rows} />
    </DashboardShell>
  )
}