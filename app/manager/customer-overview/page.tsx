import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import CustomerRankingTable from '@/app/manager/components/customer-ranking-table'

export default async function CustomerOverviewPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer, created_at, unit_decision')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('CUSTOMER OVERVIEW ERROR:', error)
  }

  const rows = (orders || []).map((order) => ({
    id: order.id,
    customer: order.customer,
    createdAt: order.created_at,
    isRejected:
      order.unit_decision === 'partial' ||
      order.unit_decision === 'unavailable',
  }))

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          Customer Overview
        </h1>
        <p className="text-xs text-gray-500">
          Ringkasan jumlah order dan reject per customer.
        </p>
      </div>

      <CustomerRankingTable rows={rows} />
    </DashboardShell>
  )
}