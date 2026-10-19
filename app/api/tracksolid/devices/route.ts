import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDeviceLocations } from '@/lib/tracksolid'

export const dynamic = 'force-dynamic'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'operational'].includes(profile.role)) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
  }

  try {
    const devices = await getDeviceLocations()

    return NextResponse.json({
      devices: devices.map((device) => ({
        imei: device.imei,
        deviceName: device.deviceName,
        online: device.online,
        gpsTime: device.gpsTime,
      })),
    })
  } catch (error) {
    console.error('TRACKSOLID DEVICES ERROR:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil daftar perangkat GPS.' },
      { status: 502 }
    )
  }
}