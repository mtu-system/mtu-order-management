import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import CreateOrderForm from './create-order-form'

export default async function CreateOrderPage() {
  const user = await requireRole(['marketing'])

  return (
    <DashboardShell user={user}>
      <CreateOrderForm />
    </DashboardShell>
  )
}