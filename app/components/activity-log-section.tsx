import { createClient } from '@/lib/supabase/server'
import { isNotableActivity, loadActivityRows } from '@/lib/activity-feed'
import ActivityLogTable from './activity-log-table'

type ActivityLogSectionProps = {
  role: 'manager' | 'operational' | 'hse' | 'marketing'
}

// Manager melihat semua entri (150 terbaru per sumber); role lain melihat
// kejadian penting saja (30 terbaru per sumber), sama seperti sebelumnya.
const CONFIG = {
  manager: { perSource: 150, notableOnly: false, filter: true },
  operational: { perSource: 30, notableOnly: true, filter: false },
  hse: { perSource: 30, notableOnly: true, filter: false },
  marketing: { perSource: 30, notableOnly: true, filter: false },
} as const

export default async function ActivityLogSection({ role }: ActivityLogSectionProps) {
  const supabase = await createClient()
  const config = CONFIG[role]

  const rows = await loadActivityRows(supabase, {
    perSource: config.perSource,
    filter: config.notableOnly ? isNotableActivity : undefined,
  })

  return (
    <ActivityLogTable
      rows={rows}
      orderBasePath={`/${role}/orders`}
      showActorFilter={config.filter}
    />
  )
}
