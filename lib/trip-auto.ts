import type { SupabaseClient } from '@supabase/supabase-js'
import type { TracksolidDevice } from '@/lib/tracksolid'
import type { Geofence } from '@/lib/geo'
import { normalizePlate } from '@/lib/plate'
import { MOVING_KMH } from '@/lib/alert-rules'
import { type JourneyRow, findPool, inFence } from '@/lib/fleet'
import { hasPosition, isLive } from '@/lib/fleet-journey'
import { TRIP_LABEL, TRIP_TIME_COLUMN, type TripStatus } from '@/lib/trip-status'
import {
  FILL_TRUCK_COLUMNS,
  LEAVE_MARGIN_M,
  MIN_LOADING_MIN,
  areaOf,
  fillTruckTimesFromGps,
  inArea,
  loadImeiByPlate,
} from '@/lib/trip-times'

// ==========================================
// STATUS TRIP OTOMATIS DARI GEOFENCE
// ==========================================
// Dijalankan cron (service role) SEBELUM unit_journey diperbarui, supaya
// geofence "sebelumnya" masih terbaca dari unit_journey:
// - Belum mulai -> On Going (Finished Loading otomatis): unit sudah tiba &
//   diam di lokasi muat order (origin_arrived_at) minimal MIN_LOADING_MIN,
//   lalu meninggalkannya sambil bergerak. finished_loading_at & on_going_at
//   diisi sekaligus. Tombol manual tetap ada.
// - Finished Loading -> On Going: tadinya di area muat, sekarang sudah di
//   luar area muat dan bergerak.
//   Lokasi muat/bongkar = geofence yang dipilih di order (order_trucks.
//   origin_fence_id / destination_fence_id, turunan dari orders lewat
//   trigger) dengan toleransi PIN_TOLERANCE_M karena titiknya sering
//   meleset. Kalau belum dipilih: geofence muat / bongkar mana pun.
// - On Going -> Finished Unloading: sudah tiba di area bongkar tujuan
//   (kalau tujuan belum diset: area bongkar mana pun), lalu meninggalkannya
//   sambil bergerak. Kalau jam tiba tidak tercatat (kolom belum ada / GPS
//   putus), fallback lama: berhenti di dalam area bongkar.
// - Finished Unloading -> Complete: masuk pool.
// Dicatat di order_history dengan field_name 'trip_status_auto'.
//
// Sekaligus mengisi jam untuk laporan Monitoring Update (hanya kalau masih
// kosong, jadi koreksi manual tidak ditimpa):
//   pool_departed_at, origin_arrived_at, destination_arrived_at.

export const AUTO_TRIP_FIELD = 'trip_status_auto'
// Unit yang belum muat tapi sudah dialokasikan (masih dipantau jam
// keluar pool & tiba di lokasi muat).
const PENDING_UNIT_STATUSES = ['ready_to_depart', 'departed', 'driver_started']
const PENDING_MAX_AGE_DAYS = 30

type ActiveTruck = {
  id: string
  order_id: string
  plate_number: string | null
  vehicle_type: string | null
  trip_status: TripStatus | null
  destination_fence_id: string | null
  origin_fence_id?: string | null
  created_at?: string | null
  pool_departed_at?: string | null
  origin_arrived_at?: string | null
  destination_arrived_at?: string | null
}

type JourneyPick = Pick<
  JourneyRow,
  'imei' | 'state' | 'fence_id' | 'fence_type' | 'fence_entered_at' | 'left_pool_at' | 'updated_at'
>

const BASE_COLUMNS = 'id, order_id, plate_number, vehicle_type, trip_status, destination_fence_id'
const TIME_COLUMNS = 'created_at, pool_departed_at, origin_arrived_at, destination_arrived_at'
const LOCATION_COLUMNS = 'origin_fence_id'
// Unit Complete yang jamnya dilengkapi dari riwayat rute per putaran cron
// (Tracksolid membatasi frekuensi permintaan).
const BACKFILL_PER_RUN = 1
const BACKFILL_DAYS = 3

// Kolom jam baru belum ada sampai migrasi 20261119 dijalankan: jangan sampai
// cron ikut gagal, cukup lewati pencatatan jam.
function missingColumn(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === '42703' || /column .* does not exist/i.test(error.message || '')))
}

async function loadTrucks(admin: SupabaseClient) {
  const sinceIso = new Date(Date.now() - PENDING_MAX_AGE_DAYS * 86400e3).toISOString()

  const query = (columns: string) =>
    Promise.all([
      admin
        .from('order_trucks')
        .select(columns)
        .in('trip_status', ['finished_loading', 'on_going', 'finished_unloading'])
        .not('plate_number', 'is', null)
        .not('status', 'in', '(cancelled,failed)')
        .limit(2000),
      admin
        .from('order_trucks')
        .select(columns)
        .is('trip_status', null)
        .in('status', PENDING_UNIT_STATUSES)
        .not('plate_number', 'is', null)
        .gte('created_at', sinceIso)
        .limit(2000),
    ])

  // Kolom baru menyusul lewat migrasi: coba dari yang paling lengkap.
  const tiers = [
    { columns: `${BASE_COLUMNS}, ${TIME_COLUMNS}, ${LOCATION_COLUMNS}`, withTimes: true, withLocations: true },
    { columns: `${BASE_COLUMNS}, ${TIME_COLUMNS}`, withTimes: true, withLocations: false },
    { columns: BASE_COLUMNS, withTimes: false, withLocations: false },
  ]
  let tier = tiers[0]
  let [active, pending] = await query(tier.columns)
  for (const next of tiers.slice(1)) {
    if (!missingColumn(active.error) && !missingColumn(pending.error)) break
    tier = next
    ;[active, pending] = await query(next.columns)
  }
  const { withTimes, withLocations } = tier

  if (active.error) throw new Error(active.error.message)

  const trucks = [
    ...((active.data || []) as unknown as ActiveTruck[]),
    ...(withTimes ? ((pending.data || []) as unknown as ActiveTruck[]) : []),
  ]
  return { trucks, withTimes, withLocations }
}

export async function runAutoTripStatus(
  admin: SupabaseClient,
  devices: TracksolidDevice[]
) {
  const [{ trucks, withTimes, withLocations }, fencesRes, linksRes, journeysRes] = await Promise.all([
    loadTrucks(admin),
    admin.from('geofences').select('id, name, type, lat, lng, radius_m'),
    admin.from('gps_device_links').select('plate_key, imei'),
    admin
      .from('unit_journey')
      .select('imei, state, fence_id, fence_type, fence_entered_at, left_pool_at, updated_at'),
  ])

  const fences = (fencesRes.data || []) as Geofence[]
  const pool = findPool(fences)
  const unloading = fences.filter((fence) => fence.type === 'unloading')
  const loading = fences.filter((fence) => fence.type === 'loading')
  const widen = (fence: Geofence) => ({ ...fence, radius_m: fence.radius_m + LEAVE_MARGIN_M })
  // Unit dianggap sudah meninggalkan lokasi muat hanya kalau di luar SEMUA
  // geofence muat (bisa ada beberapa yang tumpang tindih di satu kawasan),
  // dengan margin supaya manuver / GPS meleset di tepi area tidak terhitung.
  const outsideAllLoading = (point: { lat: number; lng: number }) =>
    !loading.some((fence) => inFence(point, widen(fence)))
  const fenceById = new Map(fences.map((fence) => [String(fence.id), fence]))
  const linkMap = new Map(
    (linksRes.data || []).map((link) => [link.plate_key as string, link.imei as string])
  )
  const byImei = new Map(devices.map((device) => [device.imei, device]))
  const indexed = devices.map((device) => ({ device, name: normalizePlate(device.deviceName) }))
  const journeyByImei = new Map(
    ((journeysRes.data || []) as JourneyPick[]).map((row) => [row.imei, row])
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
  const stamps: { truck: ActiveTruck; patch: Record<string, string> }[] = []

  for (const truck of trucks) {
    const device = resolveDevice(normalizePlate(truck.plate_number))
    // Keluar dari lokasi (muat/bongkar) butuh GPS live (bergerak); tiba di
    // lokasi / pool boleh dari posisi parkir (mesin mati, titik GPS tidak
    // bertambah).
    if (!device || device.lat === null || device.lng === null || !hasPosition(device)) continue
    const live = isLive(device)
    const moving = live && device.speed >= MOVING_KMH

    const point = { lat: device.lat, lng: device.lng }
    const stopped = device.speed < MOVING_KMH
    const prev = journeyByImei.get(device.imei)
    const prevFresh =
      prev?.updated_at && now.getTime() - new Date(prev.updated_at).getTime() < 30 * 60 * 1000
    const prevFence = prev?.fence_id ? fenceById.get(prev.fence_id) : undefined

    const originFence = truck.origin_fence_id ? fenceById.get(String(truck.origin_fence_id)) : undefined
    const destinationFence = truck.destination_fence_id
      ? fenceById.get(String(truck.destination_fence_id))
      : undefined
    const originArea = areaOf(originFence, loading)
    const destinationArea = areaOf(destinationFence, unloading)
    const atOrigin = inArea(point, originArea)
    const atDestination = inArea(point, destinationArea)
    // Sudah meninggalkan lokasi muat: di luar area + margin. Tanpa lokasi
    // order: di luar SEMUA geofence muat (bisa tumpang tindih).
    const leftOrigin = originFence
      ? !inArea(point, originArea, LEAVE_MARGIN_M)
      : outsideAllLoading(point)
    // Jam masuk area: pakai fence_entered_at dari unit_journey kalau unit
    // sudah tercatat di salah satu fence area itu sejak cron sebelumnya.
    const enteredAt = (fences: Geofence[]) =>
      prevFresh && prev?.fence_entered_at && fences.some((fence) => prev.fence_id === String(fence.id))
        ? prev.fence_entered_at
        : nowIso

    // ---------- Jam untuk laporan Monitoring Update ----------
    if (withTimes) {
      const patch: Record<string, string> = {}

      if (
        !truck.pool_departed_at &&
        (truck.trip_status === null || truck.trip_status === 'finished_loading') &&
        prev?.left_pool_at &&
        prev.state !== 'pool' &&
        truck.created_at &&
        new Date(prev.left_pool_at).getTime() >= new Date(truck.created_at).getTime()
      ) {
        patch.pool_departed_at = prev.left_pool_at
      }

      if (
        !truck.origin_arrived_at &&
        (truck.trip_status === null || truck.trip_status === 'finished_loading') &&
        stopped &&
        atOrigin
      ) {
        patch.origin_arrived_at = enteredAt(originArea.fences)
        truck.origin_arrived_at = patch.origin_arrived_at
      }

      if (
        !truck.destination_arrived_at &&
        (truck.trip_status === 'on_going' || truck.trip_status === 'finished_unloading') &&
        stopped &&
        atDestination
      ) {
        patch.destination_arrived_at = enteredAt(destinationArea.fences)
        truck.destination_arrived_at = patch.destination_arrived_at
      }

      if (Object.keys(patch).length > 0) stamps.push({ truck, patch })
    }

    // ---------- Status trip ----------
    const originName = originFence?.name || (prevFence?.type === 'loading' ? prevFence.name : 'lokasi muat')
    if (truck.trip_status === null) {
      // Finished Loading otomatis: sudah cukup lama di lokasi muat lalu pergi.
      const loadedLongEnough =
        Boolean(truck.origin_arrived_at) &&
        now.getTime() - new Date(truck.origin_arrived_at as string).getTime() >= MIN_LOADING_MIN * 60000
      if (withTimes && loadedLongEnough && moving && leftOrigin) {
        changes.push({ truck, to: 'on_going', where: `selesai muat, keluar dari ${originName}` })
      }
    } else if (truck.trip_status === 'finished_loading') {
      const wasAtOrigin = Boolean(truck.origin_arrived_at) || (prevFresh && prevFence?.type === 'loading')
      if (moving && wasAtOrigin && leftOrigin) {
        changes.push({ truck, to: 'on_going', where: `keluar dari ${originName}` })
      }
    } else if (truck.trip_status === 'on_going') {
      if (withTimes && truck.destination_arrived_at) {
        // Sudah tiba -> selesai bongkar saat meninggalkan area tujuan.
        const outside = !inArea(point, destinationArea, LEAVE_MARGIN_M)
        if (moving && outside) {
          const left =
            destinationFence?.name || (prevFence?.type === 'unloading' ? prevFence.name : 'lokasi bongkar')
          changes.push({ truck, to: 'finished_unloading', where: `meninggalkan ${left}` })
        } else if (pool && inFence(point, pool)) {
          // GPS terlewat saat keluar dari lokasi bongkar, unit sudah pulang.
          changes.push({ truck, to: 'finished_unloading', where: 'sudah kembali ke pool' })
        }
      } else if (!withTimes && stopped && atDestination) {
        const name = destinationFence?.name || unloading.find((fence) => inFence(point, fence))?.name
        changes.push({ truck, to: 'finished_unloading', where: `tiba di ${name || 'lokasi bongkar'}` })
      }
    } else if (truck.trip_status === 'finished_unloading' && pool && inFence(point, pool)) {
      changes.push({ truck, to: 'complete', where: `masuk ${pool.name}` })
    }
  }

  for (const { truck, patch } of stamps) {
    // Hanya mengisi kolom yang masih kosong.
    let query = admin.from('order_trucks').update(patch).eq('id', truck.id)
    for (const column of Object.keys(patch)) query = query.is(column, null)
    const { error } = await query
    if (error) console.error('AUTO TRIP STAMP ERROR:', error)
  }

  let applied = 0

  for (const { truck, to, where } of changes) {
    const from = truck.trip_status
    const patch: Record<string, string | null> = {
      trip_status: to,
      [TRIP_TIME_COLUMN[to]]: nowIso,
      trip_status_updated_by: null,
    }
    // Belum mulai -> On Going: Finished Loading ikut tercatat.
    if (from === null) patch.finished_loading_at = nowIso
    // Hanya kalau status belum diubah orang lain sejak dibaca.
    const base = admin.from('order_trucks').update(patch).eq('id', truck.id)
    const { data, error } = await (from === null
      ? base.is('trip_status', null)
      : base.eq('trip_status', from)
    ).select('id')

    if (error || !data || data.length === 0) {
      if (error) console.error('AUTO TRIP UPDATE ERROR:', error)
      continue
    }

    applied += 1

    const { error: historyError } = await admin.from('order_history').insert({
      order_id: truck.order_id,
      action: 'trip_status_changed',
      field_name: AUTO_TRIP_FIELD,
      old_value: from ? TRIP_LABEL[from] : 'Belum Mulai',
      new_value: TRIP_LABEL[to],
      reason: `Unit ${truck.plate_number || '-'} (${truck.vehicle_type || '-'}) · otomatis: ${where}`,
      changed_by: null,
    })
    if (historyError) console.error('AUTO TRIP HISTORY ERROR:', historyError)
  }

  const backfilled = withLocations ? await backfillFromHistory(admin, fences) : 0

  return { checked: trucks.length, applied, stamped: stamps.length, backfilled }
}

// Unit yang baru Complete: lengkapi jam yang bolong (GPS putus, parkir,
// terlewat cron 5 menit) dari riwayat rute. Satu kali per unit.
async function backfillFromHistory(admin: SupabaseClient, fences: Geofence[]) {
  const since = new Date(Date.now() - BACKFILL_DAYS * 86400e3).toISOString()
  const { data, error } = await admin
    .from('order_trucks')
    .select(FILL_TRUCK_COLUMNS)
    .eq('trip_status', 'complete')
    .gte('completed_at', since)
    .is('gps_times_filled_at', null)
    .not('plate_number', 'is', null)
    .order('completed_at', { ascending: true })
    .limit(BACKFILL_PER_RUN)

  if (error || !data || data.length === 0) {
    if (error) console.error('AUTO TRIP BACKFILL ERROR:', error)
    return 0
  }

  const trucks = data as unknown as Parameters<typeof fillTruckTimesFromGps>[1][]
  const imeiByPlate = await loadImeiByPlate(admin, trucks.map((truck) => truck.plate_number))
  let filled = 0
  for (const truck of trucks) {
    const result = await fillTruckTimesFromGps(admin, truck, { fences, imeiByPlate })
    if (result.filled.length > 0) filled += 1
  }
  return filled
}
