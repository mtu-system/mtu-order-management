import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import GeofenceManager from '@/app/components/geofence-manager'
import { type Geofence, parseFencePrefill } from '@/lib/geo'

export const dynamic = 'force-dynamic'

export default async function ManagerGeofencesPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; name?: string; type?: string }>
}) {
  const prefill = parseFencePrefill(await searchParams)
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('geofences')
    .select('id, name, type, lat, lng, radius_m')
    .order('created_at', { ascending: false })

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Geofence"
        subtitle="Tandai lokasi muat, bongkar, dan pool. Sistem memakai area ini untuk status otomatis dan menghitung unit yang pulang ke pool."
      />
      <GeofenceManager initialFences={(data || []) as Geofence[]} prefill={prefill}
        key={prefill ? `${prefill.lat},${prefill.lng}` : 'baru'}
      />
    </DashboardShell>
  )
}