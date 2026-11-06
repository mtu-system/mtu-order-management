import type { SupabaseClient } from '@supabase/supabase-js'
import { ALERT_LABEL, type AlertKind } from '@/lib/alert-rules'

export type AlertRow = {
  kind: AlertKind
  level: 'red' | 'amber'
  plate: string | null
  customer: string | null
  started_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function loadAlertRows(supabase: SupabaseClient, fromIso: string) {
  const rows: AlertRow[] = []

  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('unit_alerts')
      .select(
        'kind, level, plate, customer, started_at, acknowledged_at, resolved_at'
      )
      .gte('started_at', fromIso)
      .order('started_at', { ascending: false })
      .range(page * 1000, page * 1000 + 999)

    if (error) throw error

    rows.push(...((data || []) as AlertRow[]))
    if (!data || data.length < 1000) break
  }

  return rows
}

// Bobot nilai risiko: merah 3, oranye 1.
function points(rows: AlertRow[]) {
  return rows.reduce((sum, row) => sum + (row.level === 'red' ? 3 : 1), 0)
}

export type UnitRank = {
  plate: string
  total: number
  red: number
  amber: number
  score: number
  prevScore: number
  kinds: Partial<Record<AlertKind, number>>
}

export function buildReport(rows: AlertRow[], days: number, now = new Date()) {
  const t = now.getTime()
  const curStart = t - days * DAY_MS
  const prevStart = t - 2 * days * DAY_MS

  const startOf = (row: AlertRow) => new Date(row.started_at).getTime()
  const current = rows.filter((row) => startOf(row) >= curStart)
  const previous = rows.filter(
    (row) => startOf(row) >= prevStart && startOf(row) < curStart
  )

  // Per jenis pelanggaran
  const kinds = (Object.keys(ALERT_LABEL) as AlertKind[]).map((kind) => ({
    kind,
    label: ALERT_LABEL[kind],
    now: current.filter((row) => row.kind === kind).length,
    before: previous.filter((row) => row.kind === kind).length,
  }))

  // Per unit
  const units = new Map<string, UnitRank>()

  for (const row of current) {
    const plate = row.plate || '(tanpa plat)'
    const unit =
      units.get(plate) ||
      ({
        plate,
        total: 0,
        red: 0,
        amber: 0,
        score: 0,
        prevScore: 0,
        kinds: {},
      } as UnitRank)

    unit.total += 1
    if (row.level === 'red') unit.red += 1
    else unit.amber += 1
    unit.score += row.level === 'red' ? 3 : 1
    unit.kinds[row.kind] = (unit.kinds[row.kind] || 0) + 1
    units.set(plate, unit)
  }

  for (const row of previous) {
    const unit = units.get(row.plate || '(tanpa plat)')
    if (unit) unit.prevScore += row.level === 'red' ? 3 : 1
  }

  const ranking = Array.from(units.values()).sort(
    (a, b) => b.score - a.score || b.red - a.red
  )

  // Grafik harian (tanggal WIB)
  const dayKey = (ms: number) =>
    new Date(ms + 7 * 3600e3).toISOString().slice(0, 10)

  const daily: { day: string; red: number; amber: number }[] = []

  for (let i = days - 1; i >= 0; i--) {
    daily.push({ day: dayKey(t - i * DAY_MS), red: 0, amber: 0 })
  }

  for (const row of current) {
    const entry = daily.find((item) => item.day === dayKey(startOf(row)))
    if (!entry) continue
    if (row.level === 'red') entry.red += 1
    else entry.amber += 1
  }

  // Kecepatan penanganan peringatan merah
  const reds = current.filter((row) => row.level === 'red')
  const handled = reds.filter((row) => row.acknowledged_at)

  const handleMinutes = handled.map(
    (row) =>
      (new Date(row.acknowledged_at as string).getTime() - startOf(row)) / 60000
  )

  const avgHandleMinutes = handleMinutes.length
    ? handleMinutes.reduce((sum, value) => sum + value, 0) / handleMinutes.length
    : null

  return {
    days,
    totalNow: current.length,
    totalBefore: previous.length,
    redNow: reds.length,
    redBefore: previous.filter((row) => row.level === 'red').length,
    scoreNow: points(current),
    scoreBefore: points(previous),
    unitsAffected: units.size,
    kinds,
    ranking,
    daily,
    redHandled: handled.length,
    avgHandleMinutes,
  }
}

export type SafetyReport = ReturnType<typeof buildReport>