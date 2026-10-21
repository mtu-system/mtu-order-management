import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'
import { loadReportPlates } from '@/lib/gps-match'
import UnitReport from '@/app/components/unit-report'

export const dynamic = 'force-dynamic'

export default async function OperationalUnitReportPage({
  searchParams,
}: {
  searchParams: Promise<{ plate?: string; from?: string; to?: string }>
}) {
  const query = await searchParams
  const user = await requireRole(['operational'])
  const supabase = await createClient()
  const plates = await loadReportPlates(supabase)

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">Laporan Unit</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Rute perjalanan, jarak tempuh, parkir, dan idle per unit dari data GPS.
        </p>
      </div>
      <UnitReport
        plates={plates}
        initial={
          query.plate
            ? { plate: query.plate, from: query.from || '', to: query.to || '' }
            : undefined
        }
      />
    </DashboardShell>
  )
}