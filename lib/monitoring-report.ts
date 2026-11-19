// Data laporan "Monitoring Update" (1 file per RFT) untuk dikirim tim
// monitoring ke customer. Server only: dipanggil dari page Operational /
// Manager (client Supabase server, RLS berlaku) + posisi GPS Tracksolid.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDeviceLocations } from '@/lib/tracksolid'
import { distanceMeters, type Geofence } from '@/lib/geo'
import { plateKeyForDevice } from '@/lib/fleet'
import { hasPosition } from '@/lib/fleet-journey'
import { normalizePlate } from '@/lib/plate'
import { REGION_LABEL, regionOf } from '@/lib/regions'
import type { TripStatus } from '@/lib/trip-status'

const HIDDEN_ORDER_STATUSES = ['cancelled', 'booking_review', 'booking_rejected', 'pending']
const HIDDEN_UNIT_STATUSES = ['cancelled', 'failed']
const LOOKBACK_DAYS = 120
// RFT yang semua unitnya sudah Complete tetap tampil beberapa hari.
const KEEP_DONE_DAYS = 7
const NEAR_FENCE_KM = 30

export type ReportUnit = {
  id: string
  orderId: string
  pk: string | null
  trip: string | null
  origin: string
  destination: string
  vehicleType: string | null
  plate: string | null
  driverName: string | null
  driverPhone: string | null
  unitStatus: string | null
  tripStatus: TripStatus | null
  poolDepartedAt: string | null
  originArrivedAt: string | null
  loadedAt: string | null
  destinationArrivedAt: string | null
  unloadedAt: string | null
  poolArrivedAt: string | null
  note: string | null
  position: { text: string; lat: number | null; lng: number | null } | null
}

export type ReportGroup = {
  key: string
  customer: string
  rft: string
  pks: string[]
  trips: string[]
  units: ReportUnit[]
  activeCount: number
  doneCount: number
  lastActivity: string
}

export type MonitoringReport = {
  groups: ReportGroup[]
  timesReady: boolean
  gpsError: boolean
  fetchedAt: string
}

type TruckRow = {
  id: string
  vehicle_type: string | null
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  status: string | null
  trip_status: TripStatus | null
  finished_loading_at: string | null
  on_going_at: string | null
  finished_unloading_at: string | null
  completed_at: string | null
  destination_fence_id: string | null
  created_at: string | null
  updated_at: string | null
  pool_departed_at?: string | null
  origin_arrived_at?: string | null
  destination_arrived_at?: string | null
  monitoring_note?: string | null
}

type OrderRow = {
  id: string
  customer: string | null
  rft_tr_job: string | null
  pk_number: string | null
  trip: string | null
  status: string | null
  created_at: string
  order_trucks: TruckRow[] | null
}

const TRUCK_BASE = `id, vehicle_type, plate_number, driver_name, driver_phone, status, trip_status,
  finished_loading_at, on_going_at, finished_unloading_at, completed_at, destination_fence_id,
  created_at, updated_at`
const TRUCK_TIMES = 'pool_departed_at, origin_arrived_at, destination_arrived_at, monitoring_note'

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function groupKey(customer: string, rft: string) {
  return `${clean(customer).toUpperCase()}|${clean(rft).toUpperCase()}`
}

// "Geodipa Patuha - Cikiwul" -> ["Geodipa Patuha", "Cikiwul"].
export function splitTrip(trip: string | null) {
  const text = clean(trip)
  if (!text) return { origin: '', destination: '' }
  const parts = text.split(/\s+-\s+|\s*–\s*|\s+to\s+/i)
  if (parts.length >= 2) return { origin: parts[0], destination: parts.slice(1).join(' - ') }
  const dash = text.indexOf('-')
  if (dash > 0) return { origin: text.slice(0, dash).trim(), destination: text.slice(dash + 1).trim() }
  return { origin: text, destination: '' }
}

function latest(...values: (string | null | undefined)[]) {
  return values.filter(Boolean).sort().at(-1) || ''
}

export async function loadMonitoringReport(supabase: SupabaseClient): Promise<MonitoringReport> {
  const fetchedAt = new Date().toISOString()
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400e3).toISOString()

  const query = (truckColumns: string) =>
    supabase
      .from('orders')
      .select(`id, customer, rft_tr_job, pk_number, trip, status, created_at, order_trucks ( ${truckColumns} )`)
      .gte('created_at', sinceIso)
      .not('status', 'in', `(${HIDDEN_ORDER_STATUSES.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(1500)

  let timesReady = true
  let res = await query(`${TRUCK_BASE}, ${TRUCK_TIMES}`)
  if (res.error && (res.error.code === '42703' || /does not exist/i.test(res.error.message))) {
    timesReady = false
    res = await query(TRUCK_BASE)
  }
  if (res.error) throw new Error(res.error.message)

  const orders = (res.data || []) as unknown as OrderRow[]
  const keepDoneSince = Date.now() - KEEP_DONE_DAYS * 86400e3

  // ---------- Kelompokkan per customer + RFT ----------
  const groups = new Map<string, ReportGroup & { trucks: { order: OrderRow; truck: TruckRow }[] }>()

  for (const order of orders) {
    const customer = clean(order.customer) || '-'
    const rft = clean(order.rft_tr_job) || clean(order.pk_number) || '-'
    const key = groupKey(customer, rft)
    const trucks = (order.order_trucks || []).filter(
      (truck) => truck.plate_number && !HIDDEN_UNIT_STATUSES.includes(truck.status || '')
    )
    if (trucks.length === 0) continue

    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        customer,
        rft,
        pks: [],
        trips: [],
        units: [],
        activeCount: 0,
        doneCount: 0,
        lastActivity: '',
        trucks: [],
      }
      groups.set(key, group)
    }
    if (order.pk_number && !group.pks.includes(clean(order.pk_number))) group.pks.push(clean(order.pk_number))
    if (order.trip && !group.trips.includes(clean(order.trip))) group.trips.push(clean(order.trip))
    for (const truck of trucks) group.trucks.push({ order, truck })
  }

  const visible = Array.from(groups.values()).filter((group) =>
    group.trucks.some(
      ({ truck }) =>
        truck.trip_status !== 'complete' ||
        (truck.completed_at && new Date(truck.completed_at).getTime() >= keepDoneSince)
    )
  )

  // ---------- Posisi GPS (hanya unit yang belum Complete) ----------
  const needGps = visible.flatMap((group) =>
    group.trucks.filter(({ truck }) => truck.trip_status !== 'complete').map(({ truck }) => truck)
  )
  const deviceByPlate = new Map<string, Awaited<ReturnType<typeof getDeviceLocations>>[number]>()
  let fences: Geofence[] = []
  let gpsError = false

  if (needGps.length > 0) {
    const plateKeys = Array.from(new Set(needGps.map((truck) => normalizePlate(truck.plate_number))))
    const [devices, linksRes, fencesRes] = await Promise.all([
      getDeviceLocations().catch(() => {
        gpsError = true
        return []
      }),
      supabase.from('gps_device_links').select('plate_key, imei'),
      supabase.from('geofences').select('id, name, type, lat, lng, radius_m'),
    ])
    fences = (fencesRes.data || []) as Geofence[]
    const plateByImei = new Map(
      (linksRes.data || []).map((link) => [link.imei as string, link.plate_key as string])
    )
    for (const device of devices) {
      const key = plateKeyForDevice(device, plateByImei, plateKeys)
      if (plateKeys.includes(key) && !deviceByPlate.has(key)) deviceByPlate.set(key, device)
    }
  }

  function positionOf(truck: TruckRow): ReportUnit['position'] {
    if (truck.trip_status === 'complete') return { text: 'MTU Pool', lat: null, lng: null }
    const device = deviceByPlate.get(normalizePlate(truck.plate_number))
    if (!device || device.lat === null || device.lng === null) return null

    const point = { lat: device.lat, lng: device.lng }
    const distances = fences
      .map((fence) => ({ fence, meters: distanceMeters(point, fence) }))
      .sort((a, b) => a.meters - b.meters)
    const inside = distances
      .filter(({ fence, meters }) => meters <= fence.radius_m)
      .sort((a, b) => a.fence.radius_m - b.fence.radius_m)[0]
    const region = regionOf(point.lat, point.lng)
    const regionText = region === 'dalam_kota' ? 'Jabodetabek' : REGION_LABEL[region].replace(' (luar kota)', '')

    let text: string
    if (inside) {
      text = inside.fence.type === 'pool' ? 'MTU Pool' : inside.fence.name
    } else if (distances[0] && distances[0].meters <= NEAR_FENCE_KM * 1000) {
      text = `± ${Math.max(1, Math.round(distances[0].meters / 1000))} km dari ${distances[0].fence.name} (${regionText})`
    } else {
      text = regionText
    }
    if (!hasPosition(device)) text += ' · GPS terakhir'
    return { text, lat: point.lat, lng: point.lng }
  }

  const result: ReportGroup[] = visible.map(({ trucks, ...group }) => {
    const units = trucks
      .map(({ order, truck }): ReportUnit => {
        const { origin, destination } = splitTrip(order.trip)
        return {
          id: String(truck.id),
          orderId: String(order.id),
          pk: clean(order.pk_number) || null,
          trip: order.trip,
          origin,
          destination,
          vehicleType: truck.vehicle_type,
          plate: truck.plate_number,
          driverName: truck.driver_name,
          driverPhone: truck.driver_phone,
          unitStatus: truck.status,
          tripStatus: truck.trip_status,
          poolDepartedAt: truck.pool_departed_at || null,
          originArrivedAt: truck.origin_arrived_at || null,
          loadedAt: truck.finished_loading_at,
          destinationArrivedAt: truck.destination_arrived_at || null,
          unloadedAt: truck.finished_unloading_at,
          poolArrivedAt: truck.completed_at,
          note: truck.monitoring_note || null,
          position: positionOf(truck),
        }
      })
      .sort(
        (a, b) =>
          (a.pk || '').localeCompare(b.pk || '') || (a.plate || '').localeCompare(b.plate || '')
      )

    const lastActivity = latest(
      ...trucks.flatMap(({ order, truck }) => [order.created_at, truck.updated_at])
    )

    return {
      ...group,
      units,
      activeCount: units.filter((unit) => unit.tripStatus !== 'complete').length,
      doneCount: units.filter((unit) => unit.tripStatus === 'complete').length,
      lastActivity,
    }
  })

  result.sort(
    (a, b) =>
      Number(b.activeCount > 0) - Number(a.activeCount > 0) ||
      b.lastActivity.localeCompare(a.lastActivity)
  )

  return { groups: result, timesReady, gpsError, fetchedAt }
}
