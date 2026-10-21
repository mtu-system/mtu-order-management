import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  debugTracksolid,
  getDeviceLocations,
  getDriveStates,
} from '@/lib/tracksolid'
import { normalizePlate } from '@/lib/plate'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = [
  'manager',
  'marketing',
  'marketing_admin',
  'operational',
  'hse',
]

const MOVING_KMH = 5
const LIVE_MS = 30 * 60 * 1000
const MAX_DRIVE_UNITS = 30

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
    const searchParams = new URL(request.url).searchParams

    if (searchParams.get('debug') === '1') {
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

    const statusByPlate = new Map<string, string | null>()
    for (const unit of units || []) {
      statusByPlate.set(normalizePlate(unit.plate_number), unit.trip_status)
    }

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
    const imeiByPlate = new Map<string, string>()

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
        imeiByPlate.set(plate, hit.imei)
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

    // Durasi mengemudi: hanya untuk unit yang sedang bergerak atau On Going.
    const drive: Record<string, { driveMinutes: number; stoppedMinutes: number }> = {}

    if (searchParams.get('drive') === '1') {
      const targets = Object.entries(positions)
        .filter(([plate, position]) => {
          if (!position.online || !position.gpsTime) return false

          const age =
            Date.now() - new Date(position.gpsTime.replace(' ', 'T') + 'Z').getTime()
          if (age > LIVE_MS) return false

          return (
            position.speed >= MOVING_KMH ||
            statusByPlate.get(plate) === 'on_going'
          )
        })
        .slice(0, MAX_DRIVE_UNITS)

      const states = await getDriveStates(
        targets.map(([plate]) => imeiByPlate.get(plate) as string)
      )

      for (const [plate] of targets) {
        const state = states.get(imeiByPlate.get(plate) as string)
        if (state) drive[plate] = state
      }
    }

    return NextResponse.json({
      positions,
      drive,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('TRACKSOLID ERROR:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data GPS dari TrackSolid.' },
      { status: 502 }
    )
  }
}