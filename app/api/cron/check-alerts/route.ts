import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getDeviceLocations,
  getDriveStates,
  type TracksolidDevice,
} from '@/lib/tracksolid'
import { normalizePlate } from '@/lib/plate'
import { LIVE_MS, MOVING_KMH, evaluateAlerts } from '@/lib/alert-rules'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type OrderInfo = { customer: string; trip: string | null }

type TruckRow = {
  id: string | number
  order_id: string | number | null
  plate_number: string | null
  trip_status: string | null
  urgent_shipment: boolean | null
  orders: OrderInfo | OrderInfo[] | null
}

const MAX_DRIVE_UNITS = 30

// Peringatan yang butuh riwayat rute untuk dievaluasi.
const NEEDS_TRACK = new Set([
  'drive_red',
  'drive_amber',
  'stop_outside',
  'overspeed',
  'overspeed_long',
  'daily_amber',
  'daily_red',
])

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 })
  }

  const admin = createAdminClient()

  const [trucksRes, linksRes, openRes] = await Promise.all([
    admin
      .from('order_trucks')
      .select(
        'id, order_id, plate_number, trip_status, urgent_shipment, orders(customer, trip)'
      )
      .or(
        'status.in.(ready_to_depart,driver_started,departed,finished),trip_status.not.is.null'
      )
      .not('plate_number', 'is', null)
      .limit(2000),
    admin.from('gps_device_links').select('plate_key, imei'),
    admin
      .from('unit_alerts')
      .select('id, order_truck_id, kind')
      .is('resolved_at', null),
  ])

  if (trucksRes.error || openRes.error) {
    console.error('CRON DB ERROR:', trucksRes.error || openRes.error)
    return NextResponse.json({ error: 'Gagal membaca database.' }, { status: 500 })
  }

  // Kalau TrackSolid gagal, jangan ubah apa pun (jangan salah menutup peringatan).
  let devices: TracksolidDevice[]
  try {
    devices = await getDeviceLocations()
  } catch (error) {
    console.error('CRON TRACKSOLID ERROR:', error)
    return NextResponse.json(
      { error: 'TrackSolid gagal. Tidak ada perubahan.' },
      { status: 502 }
    )
  }

  const trucks = ((trucksRes.data || []) as unknown as TruckRow[]).filter(
    (truck) => truck.trip_status !== 'complete'
  )
  const linkMap = new Map(
    (linksRes.data || []).map((link) => [link.plate_key as string, link.imei as string])
  )
  const byImei = new Map(devices.map((device) => [device.imei, device]))
  const indexed = devices.map((device) => ({
    device,
    name: normalizePlate(device.deviceName),
  }))

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

  function isLive(device: TracksolidDevice) {
    if (!device.online || !device.gpsTime) return false
    const age = Date.now() - new Date(device.gpsTime.replace(' ', 'T') + 'Z').getTime()
    return age <= LIVE_MS
  }

  const matched = trucks.map((truck) => ({
    truck,
    device: resolveDevice(normalizePlate(truck.plate_number)),
  }))

  // Riwayat rute hanya untuk unit yang bergerak atau On Going.
  const driveImeis = Array.from(
    new Set(
      matched
        .filter(
          ({ truck, device }) =>
            device &&
            isLive(device) &&
            (device.speed >= MOVING_KMH || truck.trip_status === 'on_going')
        )
        .map(({ device }) => (device as TracksolidDevice).imei)
    )
  ).slice(0, MAX_DRIVE_UNITS)

  const driveMap = await getDriveStates(driveImeis)

  const openByKey = new Map<string, { id: string; order_truck_id: string }>()
  for (const alert of openRes.data || []) {
    openByKey.set(`${alert.order_truck_id}:${alert.kind}`, alert)
  }

  const seen = new Set<string>()
  const inserts: Record<string, unknown>[] = []
  const touches: PromiseLike<unknown>[] = []
  const driveEvaluatedByTruck = new Map<string, boolean>()
  const liveByTruck = new Map<string, boolean>()
  const activeTruckIds = new Set<string>()
  const nowDate = new Date()
  const nowIso = nowDate.toISOString()

  for (const { truck, device } of matched) {
    const truckId = String(truck.id)
    activeTruckIds.add(truckId)

    const live = device ? isLive(device) : false
    liveByTruck.set(truckId, live)

    const { candidates, driveEvaluated } = evaluateAlerts({
      tripStatus: truck.trip_status,
      hasDevice: Boolean(device),
      live,
      speed: device ? device.speed : 0,
      urgent: Boolean(truck.urgent_shipment),
      now: nowDate,
      drive: device ? driveMap.get(device.imei) : undefined,
    })

    driveEvaluatedByTruck.set(truckId, driveEvaluated)

    const order = Array.isArray(truck.orders) ? truck.orders[0] : truck.orders

    for (const candidate of candidates) {
      const key = `${truckId}:${candidate.kind}`
      seen.add(key)

      const existing = openByKey.get(key)

      if (existing) {
        touches.push(
          admin
            .from('unit_alerts')
            .update({ last_seen_at: nowIso, message: candidate.message })
            .eq('id', existing.id)
        )
      } else {
        inserts.push({
          order_truck_id: truckId,
          order_id: truck.order_id === null ? null : String(truck.order_id),
          plate: truck.plate_number,
          customer: order?.customer || null,
          trip: order?.trip || null,
          kind: candidate.kind,
          level: candidate.level,
          message: candidate.message,
        })
      }
    }
  }

  // Tutup peringatan yang kondisinya sudah hilang. Peringatan berbasis riwayat
  // hanya ditutup kalau datanya berhasil dihitung, atau unit sedang offline
  // (unit offline sudah punya peringatan "GPS tidak aktif" sendiri).
  const toResolve: string[] = []

  for (const alert of openRes.data || []) {
    const key = `${alert.order_truck_id}:${alert.kind}`
    if (seen.has(key)) continue

    const truckId = String(alert.order_truck_id)
    const stillActive = activeTruckIds.has(truckId)
    const needsTrack = NEEDS_TRACK.has(alert.kind)

    if (
      !stillActive ||
      !needsTrack ||
      driveEvaluatedByTruck.get(truckId) === true ||
      liveByTruck.get(truckId) === false
    ) {
      toResolve.push(alert.id)
    }
  }

  await Promise.all(touches)

  if (inserts.length > 0) {
    const { error } = await admin.from('unit_alerts').insert(inserts)
    if (error) console.error('CRON INSERT ERROR:', error)
  }

  if (toResolve.length > 0) {
    const { error } = await admin
      .from('unit_alerts')
      .update({ resolved_at: nowIso })
      .in('id', toResolve)
    if (error) console.error('CRON RESOLVE ERROR:', error)
  }

  return NextResponse.json({
    checked: trucks.length,
    created: inserts.length,
    resolved: toResolve.length,
  })
}