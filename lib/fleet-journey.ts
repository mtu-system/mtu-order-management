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

function isLive(device: TracksolidDevice) {
  if (!device.online || !device.gpsTime) return false
  const age = Date.now() - new Date(device.gpsTime.replace(' ', 'T') + 'Z').getTime()
  return age <= LIVE_MS
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
    if (device.lat === null || device.lng === null || !isLive(device)) continue

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
