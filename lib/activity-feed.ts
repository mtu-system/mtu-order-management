import type { SupabaseClient } from '@supabase/supabase-js'

// Baris aktivitas gabungan order_history + unit_history untuk tampilan.
// Read-only; ikut RLS user yang login.
export type ActivityRow = {
  key: string
  scope: 'order' | 'unit'
  orderId: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  changed_at: string
  customer: string
  pkNumber: string | null
  plate: string | null
}

type OrderRef = { customer: string | null; pk_number: string | null }

type HistoryRaw = {
  id: string
  order_id: string
  truck_id?: string | null
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  changed_at: string
  orders: OrderRef | OrderRef[] | null
}

const COLUMNS =
  'id, order_id, action, field_name, old_value, new_value, reason, changed_at, orders ( customer, pk_number )'

function orderOf(raw: HistoryRaw) {
  return Array.isArray(raw.orders) ? raw.orders[0] : raw.orders
}

export async function loadActivityRows(
  supabase: SupabaseClient,
  options: { perSource: number; filter?: (row: ActivityRow) => boolean }
): Promise<ActivityRow[]> {
  const [{ data: orderHistory }, { data: unitHistory }] = await Promise.all([
    supabase
      .from('order_history')
      .select(COLUMNS)
      .order('changed_at', { ascending: false })
      .limit(options.perSource),
    supabase
      .from('unit_history')
      .select(`truck_id, ${COLUMNS}`)
      .order('changed_at', { ascending: false })
      .limit(options.perSource),
  ])

  const unitRaw = (unitHistory || []) as unknown as HistoryRaw[]
  const truckIds = Array.from(
    new Set(unitRaw.map((item) => item.truck_id).filter(Boolean))
  ) as string[]

  // Plat unit untuk kalimat ("Unit B 9940 KEH ..."). Kalau gagal/ditolak
  // RLS, kalimat tetap jalan tanpa plat.
  const plateById = new Map<string, string>()
  if (truckIds.length) {
    const { data: trucks } = await supabase
      .from('order_trucks')
      .select('id, plate_number')
      .in('id', truckIds)

    for (const truck of trucks || []) {
      if (truck.plate_number) plateById.set(String(truck.id), truck.plate_number)
    }
  }

  function toRow(raw: HistoryRaw, scope: 'order' | 'unit'): ActivityRow {
    const order = orderOf(raw)
    return {
      key: `${scope}-${raw.id}`,
      scope,
      orderId: String(raw.order_id),
      action: raw.action,
      field_name: raw.field_name,
      old_value: raw.old_value,
      new_value: raw.new_value,
      reason: raw.reason,
      changed_at: raw.changed_at,
      customer: order?.customer || '-',
      pkNumber: order?.pk_number || null,
      plate: raw.truck_id ? plateById.get(String(raw.truck_id)) || null : null,
    }
  }

  const rows = [
    ...((orderHistory || []) as unknown as HistoryRaw[]).map((raw) => toRow(raw, 'order')),
    ...unitRaw.map((raw) => toRow(raw, 'unit')),
  ]
    .filter(options.filter || (() => true))
    .sort(
      (a, b) =>
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    )

  return rows
}

// Sama dengan filter lama di RecentActivityFeed: hasil HSE hanya yang Failed.
export function isNotableActivity(row: { action: string; new_value: string | null }) {
  if (row.action === 'hse_inspection') return row.new_value === 'Failed'
  return true
}
