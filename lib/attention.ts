import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePlate } from '@/lib/plate'
import { LOADING_WAIT_MAX_MIN } from '@/lib/alert-rules'
import type { JourneyRow } from '@/lib/fleet'

// ==========================================
// DAFTAR "PERLU PERHATIAN" (read-only, ikut RLS)
// ==========================================

type OrderRef = { customer: string | null; pk_number: string | null }
type Rel<T> = T | T[] | null
const one = <T,>(value: Rel<T>) => (Array.isArray(value) ? value[0] : value) || null

export type LoadingWaitItem = {
  truckId: string
  orderId: string
  plate: string
  vehicleType: string | null
  customer: string
  pkNumber: string | null
  fenceName: string
  minutes: number
}

export type AlertItem = {
  id: string
  plate: string | null
  customer: string | null
  kind: string
  level: 'red' | 'amber'
  message: string
  startedAt: string
  acknowledged: boolean
}

export type NoDestinationItem = {
  truckId: string
  orderId: string
  plate: string
  customer: string
  pkNumber: string | null
  tripStatus: string
}

export type AutoChangeItem = {
  id: string
  orderId: string
  customer: string
  from: string | null
  to: string | null
  reason: string | null
  changedAt: string
}

// Status perjalanan dianggap basi kalau tidak diperbarui cron > 30 menit.
const JOURNEY_FRESH_MS = 30 * 60 * 1000

export async function loadAttention(supabase: SupabaseClient) {
  const now = Date.now()
  const since24h = new Date(now - 24 * 3600e3).toISOString()

  const [waitingRes, journeyRes, fencesRes, alertsRes, noDestRes, autoRes] = await Promise.all([
    supabase
      .from('order_trucks')
      .select('id, order_id, plate_number, vehicle_type, status, orders ( customer, pk_number )')
      .is('trip_status', null)
      .not('plate_number', 'is', null)
      .not('status', 'in', '(cancelled,failed,finished)')
      .limit(1000),
    supabase.from('unit_journey').select('imei, plate_key, fence_id, fence_type, fence_entered_at, updated_at'),
    supabase.from('geofences').select('id, name'),
    supabase
      .from('unit_alerts')
      .select('id, plate, customer, kind, level, message, started_at, acknowledged_at')
      .is('resolved_at', null)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('order_trucks')
      .select('id, order_id, plate_number, trip_status, source, orders ( customer, pk_number )')
      .in('trip_status', ['finished_loading', 'on_going'])
      .is('destination_fence_id', null)
      .not('plate_number', 'is', null)
      .limit(500),
    supabase
      .from('order_history')
      .select('id, order_id, old_value, new_value, reason, changed_at, orders ( customer )')
      .eq('field_name', 'trip_status_auto')
      .gte('changed_at', since24h)
      .order('changed_at', { ascending: false })
      .limit(100),
  ])

  const fenceName = new Map((fencesRes.data || []).map((fence) => [String(fence.id), fence.name as string]))
  const journeyByPlate = new Map<string, Partial<JourneyRow>>()
  for (const row of (journeyRes.data || []) as Partial<JourneyRow>[]) {
    if (row.plate_key) journeyByPlate.set(row.plate_key, row)
  }

  const loadingWait: LoadingWaitItem[] = []
  for (const truck of (waitingRes.data || []) as {
    id: string
    order_id: string
    plate_number: string
    vehicle_type: string | null
    orders: Rel<OrderRef>
  }[]) {
    const journey = journeyByPlate.get(normalizePlate(truck.plate_number))
    if (!journey || journey.fence_type !== 'loading' || !journey.fence_entered_at) continue
    if (!journey.updated_at || now - new Date(journey.updated_at).getTime() > JOURNEY_FRESH_MS) continue

    const minutes = Math.round((now - new Date(journey.fence_entered_at).getTime()) / 60000)
    if (minutes < LOADING_WAIT_MAX_MIN) continue

    const order = one(truck.orders)
    loadingWait.push({
      truckId: String(truck.id),
      orderId: String(truck.order_id),
      plate: truck.plate_number,
      vehicleType: truck.vehicle_type,
      customer: order?.customer || '-',
      pkNumber: order?.pk_number || null,
      fenceName: fenceName.get(String(journey.fence_id)) || 'area muat',
      minutes,
    })
  }
  loadingWait.sort((a, b) => b.minutes - a.minutes)

  const alerts: AlertItem[] = ((alertsRes.data || []) as {
    id: string
    plate: string | null
    customer: string | null
    kind: string
    level: 'red' | 'amber'
    message: string
    started_at: string
    acknowledged_at: string | null
  }[])
    .map((alert) => ({
      id: String(alert.id),
      plate: alert.plate,
      customer: alert.customer,
      kind: alert.kind,
      level: alert.level,
      message: alert.message,
      startedAt: alert.started_at,
      acknowledged: Boolean(alert.acknowledged_at),
    }))
    .sort((a, b) =>
      a.acknowledged !== b.acknowledged
        ? Number(a.acknowledged) - Number(b.acknowledged)
        : a.level !== b.level
          ? a.level === 'red' ? -1 : 1
          : 0
    )

  const noDestination: NoDestinationItem[] = ((noDestRes.data || []) as {
    id: string
    order_id: string
    plate_number: string
    trip_status: string
    source: string | null
    orders: Rel<OrderRef>
  }[])
    .filter((truck) => truck.source !== 'vendor')
    .map((truck) => {
      const order = one(truck.orders)
      return {
        truckId: String(truck.id),
        orderId: String(truck.order_id),
        plate: truck.plate_number,
        customer: order?.customer || '-',
        pkNumber: order?.pk_number || null,
        tripStatus: truck.trip_status,
      }
    })

  const autoChanges: AutoChangeItem[] = ((autoRes.data || []) as {
    id: string
    order_id: string
    old_value: string | null
    new_value: string | null
    reason: string | null
    changed_at: string
    orders: Rel<{ customer: string | null }>
  }[]).map((row) => ({
    id: String(row.id),
    orderId: String(row.order_id),
    customer: one(row.orders)?.customer || '-',
    from: row.old_value,
    to: row.new_value,
    reason: row.reason,
    changedAt: row.changed_at,
  }))

  return {
    loadingWait,
    alerts,
    noDestination,
    autoChanges,
    journeyReady: !journeyRes.error,
  }
}
