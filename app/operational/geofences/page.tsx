import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import GeofenceManager from '@/app/components/geofence-manager'
import type { Geofence } from '@/lib/geo'

export const dynamic = 'force-dynamic'

export default async function OperationalGeofencesPage() {
  const user = await requireRole(['operational'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('geofences')
    .select('id, name, type, lat, lng, radius_m')
    .order('created_at', { ascending: false })

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Geofence</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Tandai lokasi loading dan bongkar. Sistem akan memberi saran status
          saat unit keluar atau masuk area.
        </p>
      </div>
      <GeofenceManager initialFences={(data || []) as Geofence[]} />
    </DashboardShell>
  )
}