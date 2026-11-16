import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDeviceLocations } from '@/lib/tracksolid'
import { distanceMeters, type Geofence } from '@/lib/geo'
import { LIVE_MS, MOVING_KMH } from '@/lib/alert-rules'
import { isDalamKota, regionOf } from '@/lib/regions'
import { loadFleetTrucks } from '@/lib/fleet-journey'
import {
  INACTIVE_DEVICE_DAYS,
  parseDeviceName,
  type FleetUnit,
  type JourneyRow,
  estimateArrival,
  findPool,
  inFence,
  isActiveAssignment,
  orderOfTruck,
  plateKeyForDevice,
  trucksByPlate,
} from '@/lib/fleet'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['manager', 'operational']

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
  }

  try {
    const [fencesRes, linksRes, journeysRes, trucks, devices] = await Promise.all([
      supabase.from('geofences').select('id, name, type, lat, lng, radius_m'),
      supabase.from('gps_device_links').select('plate_key, imei'),
      supabase.from('unit_journey').select('*'),
      loadFleetTrucks(supabase),
      getDeviceLocations(),
    ])

    const fences = (fencesRes.data || []) as Geofence[]
    const pool = findPool(fences)
    const plateByImei = new Map(
      (linksRes.data || []).map((link) => [link.imei as string, link.plate_key as string])
    )
    const byPlate = trucksByPlate(trucks)
    const plateKeys = Array.from(byPlate.keys())
    const journeyByImei = new Map(
      ((journeysRes.data || []) as JourneyRow[]).map((row) => [row.imei, row])
    )
    const truckById = new Map(trucks.map((truck) => [String(truck.id), truck]))
    const now = new Date()

    const units: FleetUnit[] = devices.map((device) => {
      const plateKey = plateKeyForDevice(device, plateByImei, plateKeys)
      const plateTrucks = byPlate.get(plateKey) || []
      const latest = plateTrucks[0]
      const active = plateTrucks.find(isActiveAssignment)
      const journey = journeyByImei.get(device.imei) || null

      const hasPoint = device.lat !== null && device.lng !== null
      const age = device.gpsTime
        ? now.getTime() - new Date(device.gpsTime.replace(' ', 'T') + 'Z').getTime()
        : Infinity
      const live = hasPoint && device.online && age <= LIVE_MS
      const parsedName = parseDeviceName(device.deviceName)
      const gps: FleetUnit['gps'] = !live
        ? 'offline'
        : device.speed >= MOVING_KMH
          ? 'moving'
          : device.accOn
            ? 'idle'
            : 'stopped'

      const point = hasPoint ? { lat: device.lat as number, lng: device.lng as number } : null
      const region = point ? regionOf(point.lat, point.lng) : null
      const inPool = Boolean(pool && point && inFence(point, pool))
      const distKm =
        pool && point ? Math.round(distanceMeters(point, pool) / 100) / 10 : null

      let eta: string | null = null
      if (distKm !== null && point && !inPool) {
        eta = estimateArrival(distKm, now, {
          city: isDalamKota(point.lat, point.lng),
          region,
        }).toISOString()
      }

      const reloadTruck = journey?.reload_truck_id
        ? truckById.get(journey.reload_truck_id)
        : undefined
      const reloadOrder = reloadTruck ? orderOfTruck(reloadTruck) : null
      const activeOrder = active ? orderOfTruck(active) : null

      return {
        imei: device.imei,
        plate: latest?.plate_number || parsedName.plate || device.deviceName,
        deviceName: device.deviceName,
        driver: parsedName.driver,
        base: parsedName.base,
        inactive: age > INACTIVE_DEVICE_DAYS * 86400e3,
        // Kategori armada dari nama perangkat (TH/TR/FU/PU); kalau tidak ada,
        // jenis dari order terakhir.
        vehicleType: parsedName.typeLabel || latest?.vehicle_type || null,
        lat: device.lat,
        lng: device.lng,
        speed: device.speed,
        gps,
        gpsTime: device.gpsTime,
        region,
        inPool,
        journey: journey?.state || null,
        wentOutAt: journey?.went_out_at || null,
        returnedAt: journey?.returned_at || null,
        reloadedAt: journey?.reloaded_at || null,
        distKm,
        trendKm: journey?.trend_km ?? null,
        eta,
        trip: active
          ? {
              tripStatus: active.trip_status,
              status: active.status,
              customer: activeOrder?.customer || null,
              pkNumber: activeOrder?.pk_number || null,
            }
          : null,
        reload: reloadTruck
          ? { customer: reloadOrder?.customer || null, pkNumber: reloadOrder?.pk_number || null }
          : null,
      }
    })

    return NextResponse.json({
      pool: pool ? { name: pool.name, lat: pool.lat, lng: pool.lng, radius_m: pool.radius_m } : null,
      journeyReady: !journeysRes.error,
      journeyUpdatedAt:
        ((journeysRes.data || []) as JourneyRow[])
          .map((row) => row.updated_at || '')
          .sort()
          .pop() || null,
      units,
      fetchedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('FLEET ERROR:', error)
    return NextResponse.json(
      { error: 'Gagal memuat data armada.' },
      { status: 502 }
    )
  }
}
