import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { debugTracksolid, getDeviceLocations } from '@/lib/tracksolid'
import { normalizePlate } from '@/lib/plate'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = [
  'manager',
  'marketing',
  'marketing_admin',
  'operational',
  'hse',
]

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
  }

  try {
    if (new URL(request.url).searchParams.get('debug') === '1') {
      if (profile.role !== 'manager') {
        return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
      }
      return NextResponse.json(await debugTracksolid())
    }

    const [{ data: units }, { data: links }] = await Promise.all([
      supabase
        .from('order_trucks')
        .select('plate_number, trip_status')
        .or(
          'status.in.(ready_to_depart,driver_started,departed,finished),trip_status.not.is.null'
        )
        .not('plate_number', 'is', null),
      supabase.from('gps_device_links').select('plate_key, imei'),
    ])

    const wantedPlates = Array.from(
      new Set(
        (units || [])
          .filter((unit) => unit.trip_status !== 'complete')
          .map((unit) => normalizePlate(unit.plate_number))
          .filter((plate) => plate.length >= 1)
      )
    )

    const linkMap = new Map(
      (links || []).map((link) => [link.plate_key as string, link.imei as string])
    )

    const devices = await getDeviceLocations()
    const byImei = new Map(devices.map((device) => [device.imei, device]))
    const indexed = devices.map((device) => ({
      device,
      normalizedName: normalizePlate(device.deviceName),
    }))

    const positions: Record<
      string,
      {
        deviceName: string
        lat: number | null
        lng: number | null
        speed: number
        online: boolean
        accOn: boolean
        gpsTime: string | null
      }
    > = {}

    for (const plate of wantedPlates) {
      const linkedImei = linkMap.get(plate)
      let hit = linkedImei ? byImei.get(linkedImei) : undefined

      if (!hit && plate.length >= 4) {
        hit = (
          indexed.find((item) => item.normalizedName === plate) ||
          indexed.find((item) => item.normalizedName.includes(plate))
        )?.device
      }

      if (hit) {
        positions[plate] = {
          deviceName: hit.deviceName,
          lat: hit.lat,
          lng: hit.lng,
          speed: hit.speed,
          online: hit.online,
          accOn: hit.accOn,
          gpsTime: hit.gpsTime,
        }
      }
    }

    return NextResponse.json({ positions, fetchedAt: new Date().toISOString() })
  } catch (error) {
    console.error('TRACKSOLID ERROR:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data GPS dari TrackSolid.' },
      { status: 502 }
    )
  }
}