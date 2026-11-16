// ==========================================
// ARMADA: STATUS PERJALANAN UNIT & PERKIRAAN TIBA DI POOL
// ==========================================
// Logika murni (tanpa I/O), dipakai cron (yang mencatat status perjalanan
// ke tabel unit_journey) dan API /api/fleet (yang menampilkannya).

import { distanceMeters, type Geofence } from '@/lib/geo'
import { normalizePlate } from '@/lib/plate'
import { NIGHT_END_HOUR, NIGHT_START_HOUR } from '@/lib/alert-rules'
import { isDalamKota, regionOf, type RegionId } from '@/lib/regions'

// Faktor jalan: jarak tempuh jalan ≈ jarak garis lurus × 1,3.
export const ROAD_FACTOR = 1.3
// Kecepatan rata-rata untuk perkiraan tiba (termasuk melambat/berhenti).
export const HIGHWAY_AVG_KMH = 45
export const CITY_AVG_KMH = 30
// Perkiraan waktu penyeberangan + antre kapal per pulau asal (menit).
export const CROSSING_MIN: Partial<Record<RegionId, number>> = {
  sumatera: 180,
  bali_nt: 240,
  kalimantan: 1800,
  sulawesi: 2880,
  maluku_papua: 5760,
}
// Tren jarak ke pool dihitung tiap ±30 menit; perubahan < 3 km dianggap diam.
export const TREND_WINDOW_MS = 30 * 60 * 1000
export const TREND_MIN_KM = 3
// Unit "batal pulang" tetap ditampilkan sampai 24 jam.
export const RELOADED_SHOW_MS = 24 * 60 * 60 * 1000

export type JourneyState =
  | 'pool'          // di dalam geofence pool
  | 'city'          // dalam kota, tidak tercatat dari luar kota
  | 'out_of_town'   // di luar zona dalam kota
  | 'returning'     // sudah masuk lagi zona dalam kota dari luar kota
  | 'reloaded'      // pulang tapi dapat order baru / masuk area muat

export const JOURNEY_LABEL: Record<JourneyState, string> = {
  pool: 'Di Pool',
  city: 'Dalam Kota',
  out_of_town: 'Luar Kota',
  returning: 'Pulang ke Pool',
  reloaded: 'Batal Pulang (muat lagi)',
}

export type JourneyRow = {
  imei: string
  plate_key: string | null
  state: JourneyState
  region: RegionId | null
  left_pool_at: string | null
  went_out_at: string | null
  returned_at: string | null
  reloaded_at: string | null
  reload_truck_id: string | null
  known_truck_ids: string[]
  dist_km: number | null
  ref_dist_km: number | null
  ref_at: string | null
  trend_km: number | null
  fence_id: string | null
  fence_type: string | null
  fence_entered_at: string | null
  updated_at?: string | null
}

export type FleetTruck = {
  id: string
  plate_number: string | null
  vehicle_type: string | null
  status: string | null
  trip_status: string | null
  created_at: string | null
  orders:
    | { customer: string | null; pk_number: string | null }
    | { customer: string | null; pk_number: string | null }[]
    | null
}

export function orderOfTruck(truck: FleetTruck) {
  return Array.isArray(truck.orders) ? truck.orders[0] : truck.orders
}

// Penugasan yang masih berjalan: belum selesai bongkar, tidak batal/gagal.
export function isActiveAssignment(truck: FleetTruck) {
  if (['cancelled', 'failed', 'finished'].includes(truck.status || '')) return false
  return !['finished_unloading', 'complete'].includes(truck.trip_status || '')
}

// Sudah dialokasikan ke order tapi belum muat.
export function isPendingAssignment(truck: FleetTruck) {
  return isActiveAssignment(truck) && !truck.trip_status
}

// Kelompokkan order_trucks per plat (terbaru dulu).
export function trucksByPlate(trucks: FleetTruck[]) {
  const map = new Map<string, FleetTruck[]>()
  const sorted = [...trucks].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )
  for (const truck of sorted) {
    const key = normalizePlate(truck.plate_number)
    if (key.length < 1) continue
    const list = map.get(key)
    if (list) list.push(truck)
    else map.set(key, [truck])
  }
  return map
}

// Cocokkan perangkat GPS ke plat: tautan gps_device_links dulu, lalu nama
// perangkat (sama persis / mengandung plat).
export function plateKeyForDevice(
  device: { imei: string; deviceName: string },
  plateByImei: Map<string, string>,
  knownPlateKeys: string[]
) {
  const linked = plateByImei.get(device.imei)
  if (linked) return linked

  const parsed = normalizePlate(parseDeviceName(device.deviceName).plate)
  if (parsed && knownPlateKeys.includes(parsed)) return parsed

  const name = normalizePlate(device.deviceName)
  if (knownPlateKeys.includes(name)) return name

  const hit = knownPlateKeys.find((key) => key.length >= 4 && name.includes(key))
  return hit || parsed || name
}

export function findPool(fences: Pick<Geofence, 'type' | 'lat' | 'lng' | 'radius_m' | 'name'>[]) {
  return fences.find((fence) => fence.type === 'pool') || null
}

export function inFence(
  point: { lat: number; lng: number },
  fence: { lat: number; lng: number; radius_m: number }
) {
  return distanceMeters(point, fence) <= fence.radius_m
}

export type JourneyInput = {
  imei: string
  plateKey: string
  lat: number
  lng: number
  inPool: boolean
  inLoadingFence: boolean
  // Semua id order_trucks (tidak batal/gagal) untuk plat ini saat ini.
  truckIds: string[]
  // id order_trucks yang sudah dialokasikan tapi belum muat (trip_status
  // masih kosong) -- tanda unit akan muat lagi.
  pendingTruckIds: string[]
  poolDistKm: number | null
  // Geofence tempat unit berada sekarang (kalau ada).
  fence: { id: string; type: string } | null
  now: Date
}

// Transisi status perjalanan satu unit.
export function nextJourney(prev: JourneyRow | null, input: JourneyInput): JourneyRow {
  const nowIso = input.now.toISOString()
  const inZone = isDalamKota(input.lat, input.lng)

  const base: JourneyRow = {
    imei: input.imei,
    plate_key: input.plateKey,
    state: prev?.state || 'city',
    region: regionOf(input.lat, input.lng),
    left_pool_at: prev?.left_pool_at || null,
    went_out_at: prev?.went_out_at || null,
    returned_at: prev?.returned_at || null,
    reloaded_at: prev?.reloaded_at || null,
    reload_truck_id: prev?.reload_truck_id || null,
    known_truck_ids: prev?.known_truck_ids || [],
    dist_km: input.poolDistKm,
    ref_dist_km: prev?.ref_dist_km ?? null,
    ref_at: prev?.ref_at ?? null,
    trend_km: prev?.trend_km ?? null,
    fence_id: input.fence?.id || null,
    fence_type: input.fence?.type || null,
    fence_entered_at: input.fence
      ? prev?.fence_id === input.fence.id && prev.fence_entered_at
        ? prev.fence_entered_at
        : nowIso
      : null,
  }

  // Tren jarak ke pool (negatif = mendekat).
  if (input.poolDistKm !== null) {
    const refAge = base.ref_at ? input.now.getTime() - new Date(base.ref_at).getTime() : Infinity
    if (base.ref_dist_km === null || refAge >= TREND_WINDOW_MS) {
      base.trend_km =
        base.ref_dist_km === null || refAge > 4 * TREND_WINDOW_MS
          ? null
          : Math.round((input.poolDistKm - base.ref_dist_km) * 10) / 10
      base.ref_dist_km = input.poolDistKm
      base.ref_at = nowIso
    }
  }

  if (input.inPool) {
    return {
      ...base,
      state: 'pool',
      went_out_at: null,
      returned_at: null,
      reloaded_at: null,
      reload_truck_id: null,
      known_truck_ids: [],
    }
  }

  const wasPool = prev?.state === 'pool'
  if (wasPool) base.left_pool_at = nowIso

  if (!inZone) {
    if (prev?.state === 'out_of_town') return { ...base, state: 'out_of_town' }
    // Baru keluar zona: catat penugasan yang sudah ada saat ini, supaya
    // penugasan baru nanti terdeteksi sebagai "muat lagi".
    return {
      ...base,
      state: 'out_of_town',
      went_out_at: nowIso,
      returned_at: null,
      reloaded_at: null,
      reload_truck_id: null,
      known_truck_ids: input.truckIds,
    }
  }

  // Di dalam zona dalam kota.
  if (prev?.state === 'out_of_town' || prev?.state === 'returning') {
    const known = new Set(prev.known_truck_ids || [])
    // Penugasan yang sudah ada sejak sebelum keluar kota diabaikan (data lama).
    const newAssignment = input.pendingTruckIds.find((id) => !known.has(id))

    if (newAssignment || input.inLoadingFence) {
      return {
        ...base,
        state: 'reloaded',
        reloaded_at: nowIso,
        reload_truck_id: newAssignment || null,
      }
    }

    return {
      ...base,
      state: 'returning',
      returned_at: prev.state === 'returning' ? prev.returned_at : nowIso,
    }
  }

  if (prev?.state === 'reloaded') return { ...base, state: 'reloaded' }

  return { ...base, state: 'city' }
}

function wibHour(ms: number) {
  return new Date(ms + 7 * 3600e3).getUTCHours()
}

function isNight(ms: number) {
  const hour = wibHour(ms)
  return NIGHT_START_HOUR > NIGHT_END_HOUR
    ? hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
    : hour >= NIGHT_START_HOUR && hour < NIGHT_END_HOUR
}

// Waktu (ms) berikutnya saat jam WIB = hour:00.
function nextWibHour(ms: number, hour: number) {
  const wib = new Date(ms + 7 * 3600e3)
  const target = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), hour) - 7 * 3600e3
  return target > ms ? target : target + 86400e3
}

// Perkiraan tiba di pool. Luar kota: ikut jeda istirahat malam
// (NIGHT_START_HOUR–NIGHT_END_HOUR) dan waktu penyeberangan.
export function estimateArrival(
  distKm: number,
  now: Date,
  options: { city: boolean; region: RegionId | null }
) {
  const roadKm = distKm * ROAD_FACTOR
  let remainingMin = (roadKm / (options.city ? CITY_AVG_KMH : HIGHWAY_AVG_KMH)) * 60
  let t = now.getTime()

  if (options.city) return new Date(t + remainingMin * 60000)

  remainingMin += (options.region && CROSSING_MIN[options.region]) || 0

  for (let guard = 0; remainingMin > 0 && guard < 60; guard++) {
    if (isNight(t)) {
      t = nextWibHour(t, NIGHT_END_HOUR)
      continue
    }
    const untilNight = (nextWibHour(t, NIGHT_START_HOUR) - t) / 60000
    const step = Math.min(remainingMin, untilNight)
    t += step * 60000
    remainingMin -= step
  }

  return new Date(t)
}

// Satu unit di respons /api/fleet.
export type FleetUnit = {
  imei: string
  plate: string
  deviceName: string
  driver: string | null
  base: DeviceBase
  // Tidak update > INACTIVE_DEVICE_DAYS hari: kemungkinan alat lama/dilepas.
  inactive: boolean
  vehicleType: string | null
  lat: number | null
  lng: number | null
  speed: number
  gps: 'moving' | 'idle' | 'stopped' | 'offline'
  gpsTime: string | null
  region: RegionId | null
  inPool: boolean
  journey: JourneyState | null
  wentOutAt: string | null
  returnedAt: string | null
  reloadedAt: string | null
  distKm: number | null
  trendKm: number | null
  eta: string | null
  trip: {
    tripStatus: string | null
    status: string | null
    customer: string | null
    pkNumber: string | null
  } | null
  reload: { customer: string | null; pkNumber: string | null } | null
}

export type FleetResponse = {
  pool: { name: string; lat: number; lng: number; radius_m: number } | null
  journeyReady: boolean
  journeyUpdatedAt: string | null
  units: FleetUnit[]
  fetchedAt: string
}

// ==========================================
// NAMA PERANGKAT GPS
// ==========================================
// Format di Tracksolid: "TH - B 9185 KEI - Selly", "TR.B 9731 KYZ - Edi",
// "BPN-TR.B 9964 KYX - Rifandi" (BPN = unit Balikpapan).
export const DEVICE_TYPE_LABEL: Record<string, string> = {
  TH: 'Truck Head',
  TR: 'Tronton',
  FU: 'Fuso',
  PU: 'Pick Up',
}

export type DeviceBase = 'bekasi' | 'balikpapan'

export const BASE_LABEL: Record<DeviceBase, string> = {
  bekasi: 'Pool Bekasi',
  balikpapan: 'Unit Balikpapan',
}

// Perangkat yang tidak mengirim posisi selama ini dianggap tidak terpasang.
export const INACTIVE_DEVICE_DAYS = 30

export function parseDeviceName(name: string) {
  const original = (name || '').trim()
  const upper = original.toUpperCase()

  const baseMatch = /^BPN\s*[-.]?\s*/.exec(upper)
  const base: DeviceBase = baseMatch ? 'balikpapan' : 'bekasi'
  let offset = baseMatch ? baseMatch[0].length : 0

  const codeMatch = /^(TH|TR|FU|PU)(?=[\s.\-]|B\s?\d)/.exec(upper.slice(offset))
  const typeCode = codeMatch ? codeMatch[1] : null
  if (codeMatch) offset += codeMatch[1].length

  const plateMatch = /\b([A-Z]{1,2})\s+(\d{1,4})\s+([A-Z]{1,3})\b/.exec(upper.slice(offset))
  const plate = plateMatch ? `${plateMatch[1]} ${plateMatch[2]} ${plateMatch[3]}` : null

  let driver: string | null = null
  if (plateMatch) {
    const after = original.slice(offset + plateMatch.index + plateMatch[0].length)
    driver = after.replace(/^[\s\-.]+/, '').trim() || null
  }

  return {
    base,
    typeCode,
    typeLabel: typeCode ? DEVICE_TYPE_LABEL[typeCode] : null,
    plate,
    driver,
  }
}
