import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCoordinates } from '@/lib/geo'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['manager', 'operational', 'marketing', 'marketing_admin']
const MAX_HOPS = 5

// Hanya domain Google Maps yang boleh diikuti (mencegah server dipakai
// untuk mengakses alamat lain).
function isAllowedHost(url: URL) {
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return (
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'maps.google.com' ||
    host === 'consent.google.com' ||
    /^(www\.)?google\.(com|co\.id)$/.test(host)
  )
}

// Membuka link pendek Google Maps (maps.app.goo.gl/…) lalu mengambil
// koordinat dari URL tujuannya.
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
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
  }

  let current: URL
  try {
    current = new URL(new URL(request.url).searchParams.get('url') || '')
  } catch {
    return NextResponse.json({ error: 'Link tidak valid.' }, { status: 400 })
  }

  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (!isAllowedHost(current)) {
        return NextResponse.json(
          { error: 'Hanya link Google Maps yang didukung.' },
          { status: 400 }
        )
      }

      const found = parseCoordinates(current.toString())
      if (found) return NextResponse.json(found)

      const response = await fetch(current, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTU-OrderManagement)' },
        signal: AbortSignal.timeout(8000),
      })
      const location = response.headers.get('location')

      if (!location) {
        // Halaman akhir: coba cari koordinat di isinya.
        const body = response.ok ? (await response.text()).slice(0, 200_000) : ''
        const inBody = parseCoordinates(
          /https:\/\/www\.google\.[^"'\s]*\/maps\/[^"'\s]*/.exec(body)?.[0] || ''
        ) || parseCoordinates(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/.exec(body)?.slice(1).join(',') || '')
        if (inBody) return NextResponse.json(inBody)
        break
      }

      current = new URL(location, current)
    }
  } catch (error) {
    console.error('RESOLVE LINK ERROR:', error)
  }

  return NextResponse.json(
    { error: 'Koordinat tidak ditemukan di link ini. Coba salin koordinatnya langsung.' },
    { status: 422 }
  )
}
