import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  if (!profile || !['manager', 'operational', 'hse'].includes(profile.role)) {
    return NextResponse.json({ error: 'Tidak punya akses.' }, { status: 403 })
  }

  const { data } = await supabase
    .from('unit_alerts')
    .select('id, plate, level, message, acknowledged_at')
    .is('resolved_at', null)
    .order('started_at', { ascending: false })
    .limit(100)

  return NextResponse.json({
    alerts: data || [],
    notify: profile.role === 'operational',
  })
}