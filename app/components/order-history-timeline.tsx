import { createClient } from '@/lib/supabase/server'
import { History as HistoryIcon } from 'lucide-react'
import CollapsibleSection from './collapsible-section'
import { describeActivity } from '@/lib/activity-labels'

type OrderHistoryTimelineProps = {
  orderId: string
}

const roleLabels: Record<string, string> = {
  manager: 'Manager',
  marketing: 'Marketing',
  marketing_admin: 'Marketing',
  operational: 'Operational',
  hse: 'HSE',
  vm: 'VM',
}

export default async function OrderHistoryTimeline({
  orderId,
}: OrderHistoryTimelineProps) {
  const supabase = await createClient()

  const [{ data: orderHistory }, { data: unitHistory }] = await Promise.all([
    supabase
      .from('order_history')
      .select(`
        id,
        action,
        field_name,
        old_value,
        new_value,
        reason,
        changed_at,
        changed_by
      `)
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false }),
    supabase
      .from('unit_history')
      .select(`
        id,
        truck_id,
        action,
        field_name,
        old_value,
        new_value,
        reason,
        changed_at,
        changed_by
      `)
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false }),
  ])

  const combined = [
    ...(orderHistory || []).map((item) => ({
      ...item,
      scope: 'order' as const,
    })),
    ...(unitHistory || []).map((item) => ({
      ...item,
      scope: 'unit' as const,
    })),
  ].sort(
    (a, b) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  )

  if (!combined.length) {
    return null
  }

  // Plat unit untuk kalimat riwayat (read-only, ikut RLS).
  const truckIds = Array.from(
    new Set(
      (unitHistory || [])
        .map((item) => (item as { truck_id?: string | null }).truck_id)
        .filter(Boolean)
    )
  ) as string[]
  const plateById = new Map<string, string>()
  if (truckIds.length) {
    const { data: trucks } = await supabase
      .from('order_trucks')
      .select('id, plate_number')
      .in('id', truckIds)
    for (const truck of trucks || []) {
      if (truck.plate_number) plateById.set(String(truck.id), truck.plate_number)
    }
  }

  const actorIds = Array.from(
    new Set(combined.map((item) => item.changed_by).filter(Boolean))
  ) as string[]

  let actorById: Record<string, { name: string; role: string }> = {}

  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', actorIds)

    actorById = Object.fromEntries(
      (profiles || []).map((profile) => [
        profile.id,
        {
          name: profile.full_name || 'User',
          role: roleLabels[profile.role] || profile.role,
        },
      ])
    )
  }

  return (
    <CollapsibleSection
      id="riwayat"
      title="Riwayat Unit & Order"
      subtitle="Semua perubahan tercatat di sini dan bisa dilihat oleh Marketing, Operational, dan HSE."
      icon={<HistoryIcon className="h-4.5 w-4.5" />}
      badge={
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
          {combined.length} entri
        </span>
      }
    >
      <ol className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
        {combined.map((item) => {
          const truckId = (item as { truck_id?: string | null }).truck_id
          const text = describeActivity({
            ...item,
            plate: truckId ? plateById.get(String(truckId)) || null : null,
          })
          const actor = item.changed_by ? actorById[item.changed_by] : undefined

          return (
            <li
              key={`${item.scope}-${item.id}`}
              className="flex items-start justify-between gap-4 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">
                  {text.title}
                </p>
                {text.detail && (
                  <p className="mt-0.5 text-[12px] text-slate-500">{text.detail}</p>
                )}
              </div>

              <div className="shrink-0 text-right text-[12px] tabular-nums text-slate-500">
                <p>
                  {new Date(item.changed_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {actor && (
                  <p className="mt-0.5 font-medium text-slate-600">
                    {actor.name} · {actor.role}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </CollapsibleSection>
  )
}