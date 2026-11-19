import type { SupabaseClient } from '@supabase/supabase-js'
import type { TracksolidDevice } from '@/lib/tracksolid'
import type { Geofence } from '@/lib/geo'
import { distanceMeters } from '@/lib/geo'
import { fetchAll } from '@/lib/fetch-all'
import { LIVE_MS, MOVING_KMH } from '@/lib/alert-rules'
import {
  type FleetTruck,
  type JourneyRow,
  findPool,
  inFence,
  isPendingAssignment,
  nextJourney,
  plateKeyForDevice,
  trucksByPlate,
} from '@/lib/fleet'

export const FLEET_TRUCK_COLUMNS =
  'id, plate_number, vehicle_type, status, trip_status, created_at, orders ( customer, pk_number )'

export async function loadFleetTrucks(client: SupabaseClient) {
  const { rows, error } = await fetchAll<FleetTruck>((from, to) =>
    client
      .from('order_trucks')
      .select(FLEET_TRUCK_COLUMNS)
      .not('plate_number', 'is', null)
      .not('status', 'in', '(cancelled,failed)')
      .order('created_at', { ascending: false })
      .range(from, to)
  )
  if (error) throw new Error(error.message)
  return rows
}

// Geofence terkecil yang memuat titik ini (area muat di dalam kawasan besar
// tetap terbaca sebagai area muat).
export function fenceAt(point: { lat: number; lng: number }, fences: Geofence[]) {
  const hits = fences
    .filter((fence) => inFence(point, fence))
    .sort((a, b) => a.radius_m - b.radius_m)
  return hits[0] ? { id: String(hits[0].id), type: hits[0].type } : null
}

function gpsAge(device: TracksolidDevice) {
  if (!device.gpsTime) return Infinity
  return Date.now() - new Date(device.gpsTime.replace(' ', 'T') + 'Z').getTime()
}

export function isLive(device: TracksolidDevice) {
  return device.online && gpsAge(device) <= LIVE_MS
}

// Parkir mesin mati: GPS berhenti mengirim titik baru, tapi perangkat masih
// online (heartbeat). Posisi terakhir tetap posisi unit -- jangan dianggap
// "GPS mati", dan boleh dipakai untuk cek geofence saat unit diam.
export const PARKED_MAX_MS = 24 * 60 * 60 * 1000

export function isParked(device: TracksolidDevice) {
  return (
    device.online &&
    !device.accOn &&
    device.speed < MOVING_KMH &&
    gpsAge(device) <= PARKED_MAX_MS
  )
}

// Posisi bisa dipercaya: live, atau sedang parkir.
export function hasPosition(device: TracksolidDevice) {
  return isLive(device) || isParked(device)
}

// Dipanggil cron (service role). Memperbarui unit_journey untuk semua
// perangkat yang posisinya masih segar. Unit offline tidak diubah.
export async function updateJourneys(admin: SupabaseClient, devices: TracksolidDevice[]) {
  const [fencesRes, linksRes, journeysRes, trucks] = await Promise.all([
    admin.from('geofences').select('id, name, type, lat, lng, radius_m'),
    admin.from('gps_device_links').select('plate_key, imei'),
    admin.from('unit_journey').select('*'),
    loadFleetTrucks(admin),
  ])

  if (journeysRes.error) throw new Error(journeysRes.error.message)

  const fences = (fencesRes.data || []) as Geofence[]
  const pool = findPool(fences)
  const loadingFences = fences.filter((fence) => fence.type === 'loading')
  const plateByImei = new Map(
    (linksRes.data || []).map((link) => [link.imei as string, link.plate_key as string])
  )
  const byPlate = trucksByPlate(trucks)
  const plateKeys = Array.from(byPlate.keys())
  const prevByImei = new Map(
    ((journeysRes.data || []) as JourneyRow[]).map((row) => [row.imei, row])
  )

  const now = new Date()
  const upserts: (JourneyRow & { updated_at: string })[] = []

  for (const device of devices) {
    if (device.lat === null || device.lng === null || !hasPosition(device)) continue

    const point = { lat: device.lat, lng: device.lng }
    const plateKey = plateKeyForDevice(device, plateByImei, plateKeys)
    const plateTrucks = byPlate.get(plateKey) || []

    const next = nextJourney(prevByImei.get(device.imei) || null, {
      imei: device.imei,
      plateKey,
      lat: device.lat,
      lng: device.lng,
      inPool: pool ? inFence(point, pool) : false,
      // Hanya kalau berhenti di area muat (bukan sekadar lewat).
      inLoadingFence:
        device.speed < MOVING_KMH && loadingFences.some((fence) => inFence(point, fence)),
      truckIds: plateTrucks.map((truck) => String(truck.id)),
      pendingTruckIds: plateTrucks.filter(isPendingAssignment).map((truck) => String(truck.id)),
      poolDistKm: pool ? Math.round(distanceMeters(point, pool) / 100) / 10 : null,
      fence: fenceAt(point, fences),
      now,
    })

    upserts.push({ ...next, updated_at: now.toISOString() })
  }

  if (upserts.length > 0) {
    const { error } = await admin.from('unit_journey').upsert(upserts, { onConflict: 'imei' })
    if (error) throw new Error(error.message)
  }

  return { updated: upserts.length, poolSet: Boolean(pool) }
}
