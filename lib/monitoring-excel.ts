// Excel "Monitoring Update" -- format sama dengan file monitoring Operational
// (kolom NO ... Remarks). Client only (xlsx di-lazy-load).
import type { ReportGroup, ReportUnit } from '@/lib/monitoring-report'

const WIB_MS = 7 * 3600e3
const DATE_FORMAT = 'dd/mm/yyyy hh:mm AM/PM'

export const MONITORING_HEADERS = [
  'NO',
  'Unit Type',
  'Plat Number',
  'Driver Name',
  'Phone',
  'No Request',
  'Origin',
  'Destination',
  'ATD Pool',
  'Arrival at Origin',
  'Loading at Origin',
  'Arrival at Destination',
  'Unloading At Destination',
  'Total Standby (Loading)',
  'Total Standby (Unloading)',
  'Arrival at MTU Pool',
  'Actual Leadtime',
  'Budget Leadtime',
  'Selisih Leadtime',
  'Position',
  'Remarks',
  'No PK',
] as const

// Status singkat untuk kolom Remarks (bahasa yang sama dengan file lama).
export function remarkOf(unit: ReportUnit) {
  let base: string
  switch (unit.tripStatus) {
    case 'complete':
      base = 'Done'
      break
    case 'finished_unloading':
      base = 'Done (OTW Pool)'
      break
    case 'on_going':
      base = unit.destinationArrivedAt ? 'Arrived at Destination (Unloading)' : 'On Going'
      break
    case 'finished_loading':
      base = 'Loaded at Origin'
      break
    default:
      if (unit.originArrivedAt) base = 'Arrived at Origin (Loading)'
      else if (unit.poolDepartedAt) base = 'OTW Origin'
      else if (unit.unitStatus === 'ready_to_depart' || unit.unitStatus === 'departed') base = 'Ready at Pool'
      else base = 'Unit Preparation'
  }
  return unit.note ? `${base} (${unit.note})` : base
}

// "1 Hari 4 Jam" -- sama seperti rumus INT(..)&" Hari"&TEXT(..,"h Jam").
export function formatStandby(from: string | null, to: string | null) {
  if (!from || !to) return ''
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const hours = Math.floor(ms / 3600e3)
  return `${Math.floor(hours / 24)} Hari ${hours % 24} Jam`
}

export function leadtimeDays(from: string | null, to: string | null) {
  if (!from || !to) return null
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400e3
  return Number.isFinite(days) && days >= 0 ? Math.round(days * 10) / 10 : null
}

// Excel menyimpan tanggal sebagai serial hari (zona waktu lokal = WIB).
function excelDate(value: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return (ms + WIB_MS) / 86400e3 + 25569
}

export function wibStamp(date = new Date()) {
  const wib = new Date(date.getTime() + WIB_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()}`,
    time: `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`,
    file: `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`,
  }
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60)
}

export async function downloadMonitoringExcel(group: ReportGroup) {
  const XLSX = await import('xlsx')
  const stamp = wibStamp()

  const title = `Monitoring Update — ${group.customer} — ${group.rft}`
  const subtitle = `Update per ${stamp.date} ${stamp.time} WIB`

  const DATE_COLS = [8, 9, 10, 11, 12, 15]
  const body = group.units.map((unit, index) => [
    index + 1,
    unit.vehicleType || '',
    unit.plate || '',
    unit.driverName || '',
    unit.driverPhone || '',
    group.rft,
    unit.origin,
    unit.destination,
    excelDate(unit.poolDepartedAt),
    excelDate(unit.originArrivedAt),
    excelDate(unit.loadedAt),
    excelDate(unit.destinationArrivedAt),
    excelDate(unit.unloadedAt),
    formatStandby(unit.originArrivedAt, unit.loadedAt),
    formatStandby(unit.destinationArrivedAt, unit.unloadedAt),
    excelDate(unit.poolArrivedAt),
    leadtimeDays(unit.poolDepartedAt, unit.poolArrivedAt),
    null,
    null,
    unit.position?.text || '',
    remarkOf(unit),
    unit.pk || '',
  ])

  const sheet = XLSX.utils.aoa_to_sheet([[title], [subtitle], [], [...MONITORING_HEADERS], ...body])
  const HEADER_ROW = 3 // 0-based

  body.forEach((row, r) => {
    const rowIndex = HEADER_ROW + 1 + r
    for (const c of DATE_COLS) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c })]
      if (cell && typeof cell.v === 'number') cell.z = DATE_FORMAT
    }
    const lead = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: 16 })]
    if (lead && typeof lead.v === 'number') lead.z = '0.0'

    // Posisi bisa diklik -> Google Maps.
    const unit = group.units[r]
    const pos = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: 19 })]
    if (pos && unit.position?.lat != null && unit.position?.lng != null) {
      pos.l = {
        Target: `https://www.google.com/maps?q=${unit.position.lat},${unit.position.lng}`,
        Tooltip: 'Buka di Google Maps',
      }
    }
  })

  sheet['!cols'] = [5, 18, 13, 18, 18, 22, 24, 24, 19, 19, 19, 19, 19, 14, 14, 19, 9, 9, 9, 40, 30, 18].map(
    (wch) => ({ wch })
  )
  const lastCol = MONITORING_HEADERS.length - 1
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: HEADER_ROW + body.length, c: lastCol } }),
  }
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Monitoring')
  XLSX.writeFile(
    workbook,
    `Monitoring Update - ${safeFilePart(group.customer)} - ${safeFilePart(group.rft)} - ${stamp.file}.xlsx`
  )
}
