import { requireRole } from '@/lib/auth'
import CreateOrderForm from './create-order-form'

export default async function CreateOrderPage() {
  await requireRole(['marketing'])

  return <CreateOrderForm />
}