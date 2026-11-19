// Jam perjalanan unit dari riwayat rute GPS (Tracksolid track.list), untuk
// laporan Monitoring Update. Server only. Dipakai cron (unit yang baru
// Complete) dan tombol "Isi dari GPS" di halaman Update Customer.
// Hanya mengisi kolom yang masih kosong -- isian cron / koreksi manual
// tidak ditimpa. Status trip tidak diubah di sini.
import type { SupabaseClient } from '@supabase/supabase-js'
import { distanceMeters, type Geofence } from '@/lib/geo'
import { normalizePlate } from '@/lib/plate'
import { getDeviceLocations, getTrackPoints, type RoutePoint } from '@/lib/tracksolid'

// Titik geofence lokasi order sering meleset beberapa ratus meter: untuk
// lokasi yang dipilih di order, area dianggap lebih lebar sebesar ini.
export const PIN_TOLERANCE_M = 1000
// Keluar area = di luar radius + margin (GPS meleset / manuver di tepi).
export const LEAVE_MARGIN_M = 200
// Kunjungan sesingkat ini (lewat / putar balik) tidak dihitung muat/bongkar.
export const MIN_LOADING_MIN = 15
const MIN_UNLOADING_MIN = 10
// Riwayat yang diambil paling lama sejak unit dialokasikan.
const MAX_WINDOW_DAYS = 14
const LEAD_IN_MS = 6 * 3600e3

export const GPS_TIME_FIELDS = [
  'pool_departed_at',
  'origin_arrived_at',
  'finished_loading_at',
  'destination_arrived_at',
  'finished_unloading_at',
  'completed_at',
] as const
export type GpsTimeField = (typeof GPS_TIME_FIELDS)[number]
export type GpsTimes = Partial<Record<GpsTimeField, string>>

export type Area = { fences: Geofence[]; tolerance: number }

export function areaOf(explicit: Geofence | undefined, fallback: Geofence[]): Area {
  return explicit ? { fences: [explicit], tolerance: PIN_TOLERANCE_M } : { fences: fallback, tolerance: 0 }
}

export function inArea(point: { lat: number; lng: number }, area: Area, extra = 0) {
  return area.fences.some(
    (fence) => distanceMeters(point, fence) <= fence.radius_m + area.tolerance + extra
  )
}

type Visit = { enter: number; exit: number | null }

// Kunjungan ke area, dengan histeresis: masuk di radius, keluar di
// radius + margin.
function visits(points: RoutePoint[], area: Area, startIndex = 0): Visit[] {
  const result: Visit[] = []
  let current: Visit | null = null
  let lastInside = -1

  for (let i = startIndex; i < points.length; i++) {
    const point = points[i]
    if (current === null) {
      if (inArea(point, area)) {
        current = { enter: i, exit: null }
        lastInside = i
      }
    } else if (inArea(point, area, LEAVE_MARGIN_M)) {
      lastInside = i
    } else {
      current.exit = lastInside
      result.push(current)
      current = null
    }
  }
  if (current) result.push(current)
  return result
}

function minutesBetween(points: RoutePoint[], a: number, b: number) {
  return (new Date(points[b].time).getTime() - new Date(points[a].time).getTime()) / 60000
}

// Kunjungan pertama yang cukup lama (masih di dalam = durasi sampai titik
// terakhir).
function firstStay(points: RoutePoint[], area: Area, minMinutes: number, startIndex: number) {
  if (area.fences.length === 0) return null
  return (
    visits(points, area, startIndex).find(
      (visit) => minutesBetween(points, visit.enter, visit.exit ?? points.length - 1) >= minMinutes
    ) || null
  )
}

export function deriveTimes(
  points: RoutePoint[],
  options: { pool: Geofence | null; origin: Area; destination: Area }
): GpsTimes {
  const times: GpsTimes = {}
  if (points.length === 0) return times
  const poolArea: Area | null = options.pool ? { fences: [options.pool], tolerance: 0 } : null

  const origin = firstStay(points, options.origin, MIN_LOADING_MIN, 0)
  if (origin) {
    times.origin_arrived_at = points[origin.enter].time
    if (origin.exit !== null) times.finished_loading_at = points[origin.exit].time
  }

  const afterOrigin = origin ? (origin.exit ?? points.length) + 1 : 0
  const destination =
    origin && origin.exit === null ? null : firstStay(points, options.destination, MIN_UNLOADING_MIN, afterOrigin)
  if (destination) {
    times.destination_arrived_at = points[destination.enter].time
    if (destination.exit !== null) times.finished_unloading_at = points[destination.exit].time
  }

  // ATD Pool: keluar pool terakhir sebelum tiba di lokasi muat (unit bisa
  // keluar-masuk pool dulu, mis. isi BBM).
  if (poolArea) {
    const until = origin ? origin.enter : destination ? destination.enter : points.length - 1
    let lastIn = -1
    for (let i = 0; i <= until; i++) if (inArea(points[i], poolArea)) lastIn = i
    if (lastIn >= 0) {
      const left = points.slice(lastIn + 1, until + 1).some((point) => !inArea(point, poolArea, LEAVE_MARGIN_M))
      if (left && lastIn + 1 <= until) times.pool_departed_at = points[lastIn + 1].time
    }
  }

  if (poolArea && destination && destination.exit !== null) {
    for (let i = destination.exit + 1; i < points.length; i++) {
      if (inArea(points[i], poolArea)) {
        times.completed_at = points[i].time
        break
      }
    }
  }

  return times
}

type TruckForFill = {
  id: string
  order_id: string
  plate_number: string | null
  created_at: string | null
  completed_at: string | null
  origin_fence_id: string | null
  destination_fence_id: string | null
  pool_departed_at: string | null
  origin_arrived_at: string | null
  finished_loading_at: string | null
  destination_arrived_at: string | null
  finished_unloading_at: string | null
}

export const FILL_TRUCK_COLUMNS = `id, order_id, plate_number, created_at, completed_at, origin_fence_id,
  destination_fence_id, pool_departed_at, origin_arrived_at, finished_loading_at,
  destination_arrived_at, finished_unloading_at`

export type FillResult = {
  truckId: string
  plate: string | null
  filled: GpsTimeField[]
  error?: string
}

// Isi jam kosong satu unit dari riwayat rute. `changedBy` null = Sistem.
export async function fillTruckTimesFromGps(
  admin: SupabaseClient,
  truck: TruckForFill,
  context: { fences: Geofence[]; imeiByPlate: Map<string, string> },
  changedBy: string | null = null
): Promise<FillResult> {
  const result: FillResult = { truckId: String(truck.id), plate: truck.plate_number, filled: [] }
  const markDone = () =>
    admin.from('order_trucks').update({ gps_times_filled_at: new Date().toISOString() }).eq('id', truck.id)

  const imei = context.imeiByPlate.get(normalizePlate(truck.plate_number))
  if (!imei) {
    await markDone()
    return { ...result, error: 'GPS unit tidak ditemukan' }
  }

  const empty = GPS_TIME_FIELDS.filter((field) => !truck[field as keyof TruckForFill])
  if (empty.length === 0) {
    await markDone()
    return result
  }

  const fenceById = new Map(context.fences.map((fence) => [String(fence.id), fence]))
  // Mulai sedikit sebelum alokasi: unit kadang sudah jalan sebelum diinput.
  const from = new Date(new Date(truck.created_at || Date.now() - 3 * 86400e3).getTime() - LEAD_IN_MS)
  const end = truck.completed_at ? new Date(truck.completed_at).getTime() + 2 * 3600e3 : Date.now()
  const to = new Date(Math.min(end, Date.now(), from.getTime() + MAX_WINDOW_DAYS * 86400e3))
  if (to.getTime() <= from.getTime()) return { ...result, error: 'Rentang waktu kosong' }

  const { points, failed } = await getTrackPoints(imei, from, to)
  if (points.length === 0) {
    if (failed === 0) await markDone()
    return { ...result, error: failed > 0 ? 'Tracksolid sedang membatasi permintaan' : 'Tidak ada riwayat GPS' }
  }

  const times = deriveTimes(points, {
    pool: context.fences.find((fence) => fence.type === 'pool') || null,
    origin: areaOf(
      truck.origin_fence_id ? fenceById.get(String(truck.origin_fence_id)) : undefined,
      context.fences.filter((fence) => fence.type === 'loading')
    ),
    destination: areaOf(
      truck.destination_fence_id ? fenceById.get(String(truck.destination_fence_id)) : undefined,
      context.fences.filter((fence) => fence.type === 'unloading')
    ),
  })

  const patch: Record<string, string> = {}
  for (const field of empty) {
    if (times[field]) patch[field] = times[field] as string
  }

  // Urutan jam harus masuk akal terhadap kolom yang sudah terisi.
  const merged = { ...truck, ...patch } as Record<string, string | null>
  let last = 0
  for (const field of GPS_TIME_FIELDS) {
    const value = merged[field]
    if (!value) continue
    const ms = new Date(value).getTime()
    if (ms < last && patch[field]) delete patch[field]
    else last = Math.max(last, ms)
  }

  const fields = Object.keys(patch) as GpsTimeField[]
  if (fields.length > 0) {
    let query = admin
      .from('order_trucks')
      .update({ ...patch, gps_times_filled_at: new Date().toISOString() })
      .eq('id', truck.id)
    for (const field of fields) query = query.is(field, null)
    const { data, error } = await query.select('id')
    if (error) return { ...result, error: error.message }
    if (!data || data.length === 0) return result

    await admin.from('order_history').insert({
      order_id: truck.order_id,
      action: 'monitoring_times_gps',
      field_name: 'monitoring_report',
      old_value: null,
      new_value: fields.join(', '),
      reason: `Unit ${truck.plate_number || '-'}`,
      changed_by: changedBy,
    })
  } else {
    await markDone()
  }

  return { ...result, filled: fields }
}

// IMEI per plat: gps_device_links dulu, lalu nama device Tracksolid.
export async function loadImeiByPlate(admin: SupabaseClient, plates: (string | null)[]) {
  const keys = Array.from(new Set(plates.map((plate) => normalizePlate(plate)).filter(Boolean)))
  const map = new Map<string, string>()
  if (keys.length === 0) return map

  const { data: links } = await admin.from('gps_device_links').select('plate_key, imei').in('plate_key', keys)
  for (const link of links || []) map.set(link.plate_key as string, link.imei as string)

  const missing = keys.filter((key) => !map.has(key))
  if (missing.length > 0) {
    const devices = await getDeviceLocations().catch(() => [])
    const indexed = devices.map((device) => ({ imei: device.imei, name: normalizePlate(device.deviceName) }))
    for (const key of missing) {
      if (key.length < 4) continue
      const hit = indexed.find((item) => item.name === key) || indexed.find((item) => item.name.includes(key))
      if (hit) map.set(key, hit.imei)
    }
  }
  return map
}
