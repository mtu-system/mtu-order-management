import { createClient } from '@/lib/supabase/client'

type OrderHistoryInput = {
  orderId: string
  action: string
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  changedBy?: string | null
}

type UnitHistoryInput = {
  truckId: string
  orderId: string
  action: string
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  changedBy?: string | null
}

export async function logOrderHistory(
  input: OrderHistoryInput
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('order_history')
    .insert({
      order_id: input.orderId,
      action: input.action,
      field_name: input.fieldName || null,
      old_value: input.oldValue || null,
      new_value: input.newValue || null,
      reason: input.reason || null,
      changed_by: input.changedBy || null,
    })

  if (error) {
    console.error(
      'ORDER HISTORY ERROR:',
      error
    )

    throw error
  }
}

export async function logUnitHistory(
  input: UnitHistoryInput
) {
  const supabase = createClient()

  const { error } = await supabase
    .from('unit_history')
    .insert({
      truck_id: input.truckId,
      order_id: input.orderId,
      action: input.action,
      field_name: input.fieldName || null,
      old_value: input.oldValue || null,
      new_value: input.newValue || null,
      reason: input.reason || null,
      changed_by: input.changedBy || null,
    })

  if (error) {
    console.error(
      'UNIT HISTORY ERROR:',
      error
    )

    throw error
  }
}