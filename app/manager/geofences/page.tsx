import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import GeofenceManager from '@/app/components/geofence-manager'
import type { Geofence } from '@/lib/geo'

export const dynamic = 'force-dynamic'

export default async function ManagerGeofencesPage() {
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
        subtitle="Tandai lokasi loading dan bongkar. Sistem akan memberi saran status saat unit keluar atau masuk area."
      />
      <GeofenceManager initialFences={(data || []) as Geofence[]} />
    </DashboardShell>
  )
}