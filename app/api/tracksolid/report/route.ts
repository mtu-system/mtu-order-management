import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDeviceLocations, getUnitReport } from '@/lib/tracksolid'
import { loadReportPlates, resolveDevice } from '@/lib/gps-match'
import { normalizePlate } from '@/lib/plate'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = [
  'manager',
  'marketing',
  'marketing_admin',
  'operational',
  'hse',
]

const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000 + 60_000

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

  const params = new URL(request.url).searchParams
  const plateKey = normalizePlate(params.get('plate'))
  const from = new Date(params.get('from') || '')
  let to = new Date(params.get('to') || '')

  if (!plateKey || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 })
  }

  const now = new Date()
  if (to > now) to = now

  if (from >= to) {
    return NextResponse.json({ error: 'Rentang waktu tidak valid.' }, { status: 400 })
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: 'Rentang maksimal 7 hari per laporan.' },
      { status: 400 }
    )
  }

  // Plat harus termasuk yang boleh dilihat user ini.
  const visible = await loadReportPlates(supabase)
  if (!visible.some((plate) => normalizePlate(plate) === plateKey)) {
    return NextResponse.json({ error: 'Unit tidak ditemukan.' }, { status: 404 })
  }

  try {
    const devices = await getDeviceLocations()
    const device = await resolveDevice(supabase, plateKey, devices)

    if (!device) {
      return NextResponse.json(
        {
          error:
            'Unit ini belum terhubung ke perangkat GPS. Hubungkan lewat menu Unit GPS.',
        },
        { status: 404 }
      )
    }

    const report = await getUnitReport(device.imei, from, to)

    const allFailed = report.info.every((call) => call.code !== 0)
    if (allFailed) {
      return NextResponse.json(
        { error: 'TrackSolid menolak permintaan laporan.', info: report.info },
        { status: 502 }
      )
    }

    return NextResponse.json({
      deviceName: device.deviceName,
      from: from.toISOString(),
      to: to.toISOString(),
      ...report,
    })
  } catch (error) {
    console.error('TRACKSOLID REPORT ERROR:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil laporan dari TrackSolid.' },
      { status: 502 }
    )
  }
}