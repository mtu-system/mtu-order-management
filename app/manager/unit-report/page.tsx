import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import { createClient } from '@/lib/supabase/server'
import { loadReportPlates } from '@/lib/gps-match'
import UnitReport from '@/app/components/unit-report'

export const dynamic = 'force-dynamic'

export default async function ManagerUnitReportPage({
  searchParams,
}: {
  searchParams: Promise<{ plate?: string; from?: string; to?: string }>
}) {
  const query = await searchParams
  const user = await requireRole(['manager'])
  const supabase = await createClient()
  const plates = await loadReportPlates(supabase)

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Laporan Unit"
        subtitle="Rute perjalanan, jarak tempuh, parkir, dan idle per unit dari data GPS."
      />
      <UnitReport
        plates={plates}
        geofenceBase="/manager/geofences"
        initial={
          query.plate
            ? { plate: query.plate, from: query.from || '', to: query.to || '' }
            : undefined
        }
      />
    </DashboardShell>
  )
}