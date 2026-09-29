import { createClient } from '@/lib/supabase/server'
import { History as HistoryIcon } from 'lucide-react'
import CollapsibleSection from './collapsible-section'

type OrderHistoryTimelineProps = {
  orderId: string
}

const actionLabels: Record<string, string> = {
  reduce_unit: 'Kurangi Unit',
  add_unit: 'Tambah Unit',
  change_vehicle: 'Ganti Jenis Unit',
  change_trip: 'Ubah Trip',
  change_pk: 'Ubah PK',
  change_rft: 'Ubah RFT/TR/Job',
  change_customer: 'Ubah Customer',
  change_instruction: 'Ubah Instruksi',
  change_note: 'Ubah Catatan',
  cancel_order: 'Batalkan Order',
  replace_failed_unit: 'Ganti Detail Truk (Unit Failed)',
  failed_unit_to_vendor: 'Unit Failed Dialihkan ke Vendor',
  cancel_failed_unit: 'Unit Failed Dibatalkan',
  hse_inspection: 'Pemeriksaan HSE',
  unit_allocation: 'Alokasi Unit',
  create_order: 'Order/Booking Dibuat',
  booking_capacity_check: 'Cek Kapasitas oleh Operational',
  booking_revised: 'Booking Direvisi oleh Marketing',
  booking_approved: 'Booking Di-approve, Mulai Diproses',
  booking_cancelled: 'Booking Dibatalkan',
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
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
          {combined.length} entri
        </span>
      }
    >
      <div className="space-y-3">
        {combined.map((item) => (
          <div
            key={`${item.scope}-${item.id}`}
            className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-gray-900">
                  {actionLabels[item.action] || item.action}
                </p>

                {item.old_value && item.new_value && (
                  <p className="mt-1 text-sm text-gray-600">
                    {item.old_value} → {item.new_value}
                  </p>
                )}

                {item.reason && (
                  <p className="mt-1 text-xs text-gray-500">{item.reason}</p>
                )}
              </div>

              <span className="shrink-0 text-right text-xs text-gray-400">
                <span className="block">
                  {new Date(item.changed_at).toLocaleString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                  })}
                </span>
                {item.changed_by && actorById[item.changed_by] && (
                  <span className="mt-0.5 block font-semibold text-gray-500">
                    {actorById[item.changed_by].name} ·{' '}
                    {actorById[item.changed_by].role}
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}