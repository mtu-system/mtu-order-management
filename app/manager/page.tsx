import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'

export default async function ManagerPage() {
  const user = await requireRole(['manager'])

  return (
    <DashboardShell user={user}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard Manager
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Monitoring aktivitas Order Management.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Order Hari Ini"
            value="0"
          />

          <DashboardCard
            title="Waiting Unit"
            value="0"
          />

          <DashboardCard
            title="Waiting HSE"
            value="0"
          />

          <DashboardCard
            title="Ready Loading"
            value="0"
          />
        </div>
      </div>
    </DashboardShell>
  )
}

function DashboardCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  )
}