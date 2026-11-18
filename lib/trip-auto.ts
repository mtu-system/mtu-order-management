import type { SupabaseClient } from '@supabase/supabase-js'
import type { TracksolidDevice } from '@/lib/tracksolid'
import type { Geofence } from '@/lib/geo'
import { normalizePlate } from '@/lib/plate'
import { MOVING_KMH } from '@/lib/alert-rules'
import { type JourneyRow, findPool, inFence } from '@/lib/fleet'
import { isLive } from '@/lib/fleet-journey'
import { TRIP_LABEL, TRIP_TIME_COLUMN, type TripStatus } from '@/lib/trip-status'

// ==========================================
// STATUS TRIP OTOMATIS DARI GEOFENCE
// ==========================================
// Dijalankan cron (service role) SEBELUM unit_journey diperbarui, supaya
// geofence "sebelumnya" masih terbaca dari unit_journey:
// - Finished Loading -> On Going: tadinya tercatat di area muat, sekarang
//   sudah di luar dan bergerak. (Lokasi muat tanpa geofence: tetap manual.)
// - On Going -> Finished Unloading: berhenti di area bongkar tujuan
//   (kalau tujuan belum diset: area bongkar mana pun).
// - Finished Unloading -> Complete: masuk pool.
// Dicatat di order_history dengan field_name 'trip_status_auto'.

export const AUTO_TRIP_FIELD = 'trip_status_auto'
const LEAVE_MARGIN_M = 200

type ActiveTruck = {
  id: string
  order_id: string
  plate_number: string | null
  vehicle_type: string | null
  trip_status: TripStatus
  destination_fence_id: string | null
}

export async function runAutoTripStatus(
  admin: SupabaseClient,
  devices: TracksolidDevice[]
) {
  const [trucksRes, fencesRes, linksRes, journeysRes] = await Promise.all([
    admin
      .from('order_trucks')
      .select('id, order_id, plate_number, vehicle_type, trip_status, destination_fence_id')
      .in('trip_status', ['finished_loading', 'on_going', 'finished_unloading'])
      .not('plate_number', 'is', null)
      .not('status', 'in', '(cancelled,failed)')
      .limit(2000),
    admin.from('geofences').select('id, name, type, lat, lng, radius_m'),
    admin.from('gps_device_links').select('plate_key, imei'),
    admin.from('unit_journey').select('imei, fence_id, fence_type, updated_at'),
  ])

  if (trucksRes.error) throw new Error(trucksRes.error.message)

  const fences = (fencesRes.data || []) as Geofence[]
  const pool = findPool(fences)
  const unloading = fences.filter((fence) => fence.type === 'unloading')
  const loading = fences.filter((fence) => fence.type === 'loading')
  // Unit dianggap sudah meninggalkan lokasi muat hanya kalau di luar SEMUA
  // geofence muat (bisa ada beberapa yang tumpang tindih di satu kawasan),
  // dengan margin supaya manuver / GPS meleset di tepi area tidak terhitung.
  const outsideAllLoading = (point: { lat: number; lng: number }) =>
    !loading.some((fence) =>
      inFence(point, { ...fence, radius_m: fence.radius_m + LEAVE_MARGIN_M })
    )
  const fenceById = new Map(fences.map((fence) => [String(fence.id), fence]))
  const linkMap = new Map(
    (linksRes.data || []).map((link) => [link.plate_key as string, link.imei as string])
  )
  const byImei = new Map(devices.map((device) => [device.imei, device]))
  const indexed = devices.map((device) => ({ device, name: normalizePlate(device.deviceName) }))
  const journeyByImei = new Map(
    ((journeysRes.data || []) as Pick<JourneyRow, 'imei' | 'fence_id' | 'fence_type' | 'updated_at'>[]).map(
      (row) => [row.imei, row]
    )
  )

  function resolveDevice(plateKey: string) {
    const linked = linkMap.get(plateKey)
    const direct = linked ? byImei.get(linked) : undefined
    if (direct) return direct
    if (plateKey.length < 4) return undefined
    return (
      indexed.find((item) => item.name === plateKey) ||
      indexed.find((item) => item.name.includes(plateKey))
    )?.device
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const changes: { truck: ActiveTruck; to: TripStatus; where: string }[] = []

  for (const truck of (trucksRes.data || []) as ActiveTruck[]) {
    const device = resolveDevice(normalizePlate(truck.plate_number))
    if (!device || device.lat === null || device.lng === null || !isLive(device)) continue

    const point = { lat: device.lat, lng: device.lng }
    const stopped = device.speed < MOVING_KMH

    if (truck.trip_status === 'finished_loading') {
      const prev = journeyByImei.get(device.imei)
      const prevFresh =
        prev?.updated_at && now.getTime() - new Date(prev.updated_at).getTime() < 30 * 60 * 1000
      const prevFence = prev?.fence_id ? fenceById.get(prev.fence_id) : undefined

      if (
        prevFresh &&
        prevFence?.type === 'loading' &&
        outsideAllLoading(point) &&
        device.speed >= MOVING_KMH
      ) {
        changes.push({ truck, to: 'on_going', where: `keluar dari ${prevFence.name}` })
      }
    } else if (truck.trip_status === 'on_going' && stopped) {
      const destination = truck.destination_fence_id
        ? fenceById.get(String(truck.destination_fence_id))
        : undefined
      const candidates = destination ? [destination] : unloading
      const hit = candidates.find((fence) => inFence(point, fence))

      if (hit) changes.push({ truck, to: 'finished_unloading', where: `tiba di ${hit.name}` })
    } else if (truck.trip_status === 'finished_unloading' && pool && inFence(point, pool)) {
      changes.push({ truck, to: 'complete', where: `masuk ${pool.name}` })
    }
  }

  let applied = 0

  for (const { truck, to, where } of changes) {
    // Hanya kalau status belum diubah orang lain sejak dibaca.
    const { data, error } = await admin
      .from('order_trucks')
      .update({
        trip_status: to,
        [TRIP_TIME_COLUMN[to]]: nowIso,
        trip_status_updated_by: null,
      })
      .eq('id', truck.id)
      .eq('trip_status', truck.trip_status)
      .select('id')

    if (error || !data || data.length === 0) {
      if (error) console.error('AUTO TRIP UPDATE ERROR:', error)
      continue
    }

    applied += 1

    const { error: historyError } = await admin.from('order_history').insert({
      order_id: truck.order_id,
      action: 'trip_status_changed',
      field_name: AUTO_TRIP_FIELD,
      old_value: TRIP_LABEL[truck.trip_status],
      new_value: TRIP_LABEL[to],
      reason: `Unit ${truck.plate_number || '-'} (${truck.vehicle_type || '-'}) · otomatis: ${where}`,
      changed_by: null,
    })
    if (historyError) console.error('AUTO TRIP HISTORY ERROR:', historyError)
  }

  return { checked: (trucksRes.data || []).length, applied }
}
