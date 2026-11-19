'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Kolom yang boleh dikoreksi dari halaman Update Customer. Hanya jam &
// catatan -- status trip tetap lewat Monitoring.
const TIME_FIELDS = {
  pool_departed_at: 'ATD Pool',
  origin_arrived_at: 'Arrival at Origin',
  finished_loading_at: 'Loading at Origin',
  destination_arrived_at: 'Arrival at Destination',
  finished_unloading_at: 'Unloading at Destination',
  completed_at: 'Arrival at MTU Pool',
} as const

export type MonitoringTimeField = keyof typeof TIME_FIELDS
export type MonitoringPatch = Partial<Record<MonitoringTimeField, string | null>> & {
  monitoring_note?: string | null
}

export type SaveResult = { ok: true } | { ok: false; message: string }

function wibText(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export async function saveMonitoringUnit(truckId: string, patch: MonitoringPatch): Promise<SaveResult> {
  const user = await requireRole(['operational', 'manager'])
  const admin = createAdminClient()

  const update: Record<string, string | null> = {}
  for (const [field, value] of Object.entries(patch)) {
    if (field === 'monitoring_note') {
      const note = typeof value === 'string' ? value.trim().slice(0, 300) : ''
      update.monitoring_note = note || null
      continue
    }
    if (!(field in TIME_FIELDS)) return { ok: false, message: `Kolom tidak dikenal: ${field}` }
    if (value === null || value === '') {
      update[field] = null
      continue
    }
    const time = new Date(String(value))
    if (!Number.isFinite(time.getTime())) return { ok: false, message: 'Format jam tidak valid.' }
    update[field] = time.toISOString()
  }
  if (Object.keys(update).length === 0) return { ok: true }

  const columns = ['id', 'order_id', 'plate_number', ...Object.keys(update)].join(', ')
  const { data: before, error: readError } = await admin
    .from('order_trucks')
    .select(columns)
    .eq('id', truckId)
    .single()
  if (readError || !before) {
    return {
      ok: false,
      message: /does not exist/i.test(readError?.message || '')
        ? 'Kolom laporan belum ada. Jalankan migrasi 20261119_monitoring_report.sql dulu.'
        : 'Unit tidak ditemukan.',
    }
  }
  const row = before as unknown as Record<string, string | null>

  const { error } = await admin.from('order_trucks').update(update).eq('id', truckId)
  if (error) return { ok: false, message: error.message }

  const changes = Object.keys(update)
    .filter((field) => (row[field] || null) !== (update[field] || null))
    .map((field) =>
      field === 'monitoring_note'
        ? `Remarks: ${update[field] || '-'}`
        : `${TIME_FIELDS[field as MonitoringTimeField]}: ${wibText(row[field])} → ${wibText(update[field])}`
    )

  if (changes.length > 0) {
    await admin.from('order_history').insert({
      order_id: row.order_id,
      action: 'monitoring_times_updated',
      field_name: 'monitoring_report',
      old_value: null,
      new_value: changes.join(' · '),
      reason: `Unit ${row.plate_number || '-'}`,
      changed_by: user.id,
    })
  }

  revalidatePath('/operational/monitoring-report')
  revalidatePath('/manager/monitoring-report')
  return { ok: true }
}
