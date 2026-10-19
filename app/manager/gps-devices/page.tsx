import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import GpsLinkManager from '@/app/components/gps-link-manager'

export const dynamic = 'force-dynamic'

export default async function ManagerGpsDevicesPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const [{ data: links }, { data: units }] = await Promise.all([
    supabase
      .from('gps_device_links')
      .select('id, plate_key, plate_label, imei')
      .order('created_at', { ascending: false }),
    supabase
      .from('order_trucks')
      .select('plate_number')
      .or(
        'status.in.(ready_to_depart,driver_started,departed,finished),trip_status.not.is.null'
      )
      .neq('trip_status', 'complete')
      .not('plate_number', 'is', null)
      .limit(500),
  ])

  const activePlates = Array.from(
    new Set((units || []).map((unit) => unit.plate_number as string))
  )

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Unit GPS</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Hubungkan plat unit ke perangkat TrackSolid yang namanya tidak sama
          dengan plat.
        </p>
      </div>
      <GpsLinkManager initialLinks={links || []} activePlates={activePlates} />
    </DashboardShell>
  )
}