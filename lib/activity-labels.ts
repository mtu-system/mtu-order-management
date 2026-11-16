// ==========================================
// LABEL & KALIMAT AKTIVITAS (order_history / unit_history)
// ==========================================
// Satu-satunya sumber label aktivitas di app. Dipakai Activity Logs
// manager, halaman Aktivitas tiap role, widget dashboard, dan riwayat di
// detail order -- supaya kalimatnya sama di mana pun.
//
// Hanya untuk TAMPILAN. Kode action yang disimpan di database tidak berubah.

export type ActivityEntry = {
  action: string
  field_name?: string | null
  old_value?: string | null
  new_value?: string | null
  reason?: string | null
  // Plat unit (dari order_trucks lewat truck_id) untuk entri unit_history.
  plate?: string | null
  scope?: 'order' | 'unit'
}

export type ActivityText = {
  title: string
  detail: string | null
}

// Label singkat (kata benda) -- untuk chip/filter dan fallback.
export const ACTION_LABEL: Record<string, string> = {
  create_order: 'Order Dibuat',
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
  failed_unit_to_vendor: 'Unit Failed ke Vendor',
  cancel_failed_unit: 'Unit Failed Dibatalkan',
  hse_inspection: 'Pemeriksaan HSE',
  unit_allocation: 'Alokasi Unit',
  ready_to_depart: 'Ready to Depart',
  reject_change_request: 'Tolak Perubahan',
  booking_capacity_check: 'Cek Kapasitas Booking',
  booking_revised: 'Booking Direvisi',
  booking_approved: 'Booking Di-approve',
  booking_cancelled: 'Booking Dibatalkan',
  trip_status_changed: 'Status Trip',
}

export const actorLabel: Record<string, string> = {
  create_order: 'Marketing',
  booking_revised: 'Marketing',
  booking_approved: 'Marketing',
  booking_cancelled: 'Marketing',
  reduce_unit: 'Operational',
  add_unit: 'Operational',
  change_vehicle: 'Operational',
  change_trip: 'Operational',
  change_pk: 'Operational',
  change_rft: 'Operational',
  change_customer: 'Operational',
  change_instruction: 'Operational',
  change_note: 'Operational',
  cancel_order: 'Operational',
  replace_failed_unit: 'Operational',
  failed_unit_to_vendor: 'Operational',
  cancel_failed_unit: 'Operational',
  ready_to_depart: 'Operational',
  reject_change_request: 'Operational',
  unit_allocation: 'Operational',
  booking_capacity_check: 'Operational',
  trip_status_changed: 'Operational',
  hse_inspection: 'HSE',
}

// Status order/unit yang kadang tersimpan mentah di old_value/new_value.
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  waiting_unit: 'Waiting Unit',
  vendor_process: 'Proses Vendor',
  waiting_hse: 'Waiting HSE',
  inspection: 'Inspeksi',
  ready_loading: 'Ready Loading',
  ready_to_depart: 'Ready to Depart',
  pending: 'Pending',
  cancelled: 'Dibatalkan',
  failed: 'Failed',
  vm: 'Vendor / VM',
  booking_review: 'Menunggu Cek Kapasitas',
  booking_confirmed: 'Mumpuni',
  booking_rejected: 'Tidak Mumpuni',
}

const FIELD_LABEL: Record<string, string> = {
  change_trip: 'Trip',
  change_pk: 'Nomor PK',
  change_rft: 'RFT/TR/Job',
  change_customer: 'Customer',
  change_instruction: 'Instruksi',
  change_note: 'Catatan',
}

function clean(value: string | null | undefined) {
  const trimmed = (value || '').trim()
  return trimmed && trimmed !== '-' ? trimmed : null
}

function status(value: string | null | undefined) {
  const v = clean(value)
  return v ? STATUS_LABEL[v] || v : null
}

function arrow(from: string | null, to: string | null) {
  if (from && to) return `${from} → ${to}`
  return to || from
}

// "B 9940 KEH · Budi" -> "B 9940 KEH"
function firstPart(value: string | null | undefined, index = 0) {
  const part = (value || '').split(' · ')[index]
  return clean(part)
}

// Ditulis monitoring-board: "Unit B 9940 KEH (Wingbox)". Cron status
// otomatis menambah " · otomatis: tiba di Gudang X".
function parseUnitReason(reason: string | null | undefined) {
  const match = /^Unit (.+?) \((.*?)\)(?: · (otomatis: .*))?$/.exec((reason || '').trim())
  if (!match) return { plate: null, vehicleType: null, note: null }
  return { plate: clean(match[1]), vehicleType: clean(match[2]), note: clean(match[3]) }
}

// Perubahan yang dibuat sistem (cron), bukan orang.
export const AUTO_FIELD_NAMES = new Set(['trip_status_auto'])

export function actorOf(entry: { action: string; field_name?: string | null }) {
  if (entry.field_name && AUTO_FIELD_NAMES.has(entry.field_name)) return 'Sistem'
  return actorLabel[entry.action] || 'System'
}

function summarizeAllocation(raw: string | null | undefined): ActivityText | null {
  try {
    const rows = JSON.parse(raw || '')
    if (!Array.isArray(rows)) return null

    let internal = 0
    let vendor = 0
    let unavailable = 0
    const perType: string[] = []

    for (const row of rows) {
      const i = Number(row?.internal) || 0
      const v = Number(row?.vendor) || 0
      const u = Number(row?.unavailable) || 0
      internal += i
      vendor += v
      unavailable += u

      const parts = [
        i ? `${i} internal` : null,
        v ? `${v} vendor` : null,
        u ? `${u} tidak tersedia` : null,
      ].filter(Boolean)
      if (row?.vehicle_type && parts.length) {
        perType.push(`${row.vehicle_type}: ${parts.join(', ')}`)
      }
    }

    const totals = [
      `${internal} internal`,
      `${vendor} vendor`,
      unavailable ? `${unavailable} tidak tersedia` : null,
    ].filter(Boolean)

    return {
      title: `Alokasi unit disimpan: ${totals.join(' · ')}`,
      detail: perType.length > 1 ? perType.join(' · ') : null,
    }
  } catch {
    return null
  }
}

function humanize(code: string) {
  const text = code.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : code
}

export function describeActivity(entry: ActivityEntry): ActivityText {
  const from = clean(entry.old_value)
  const to = clean(entry.new_value)
  const reason = clean(entry.reason)
  const isUnit = entry.scope === 'unit'
  const unit = clean(entry.plate)
  const unitLabel = unit ? `Unit ${unit}` : 'Unit'

  switch (entry.action) {
    case 'create_order':
      return {
        title: to === 'booking_review' ? 'Booking baru dibuat' : 'Order baru dibuat',
        detail: reason,
      }

    case 'trip_status_changed': {
      const parsed = parseUnitReason(entry.reason)
      const plate = unit || parsed.plate
      const auto = entry.field_name ? AUTO_FIELD_NAMES.has(entry.field_name) : false
      return {
        title: `Status trip ${plate || 'unit'}: ${arrow(from, to) || '-'}`,
        detail:
          [parsed.vehicleType, auto ? `Otomatis dari GPS${parsed.note ? ` (${parsed.note.replace(/^otomatis: /, '')})` : ''}` : parsed.note]
            .filter(Boolean)
            .join(' · ') || null,
      }
    }

    case 'hse_inspection':
      return {
        title: `Inspeksi HSE ${unit || 'unit'}: ${to || '-'}`,
        detail: reason === 'Tidak ada catatan dari HSE.' ? null : reason,
      }

    case 'change_trip':
    case 'change_pk':
    case 'change_rft':
    case 'change_customer': {
      const field = FIELD_LABEL[entry.action]
      const change = arrow(from, to)
      return {
        title: change ? `${field} diubah: ${change}` : `${field} diubah`,
        detail: reason,
      }
    }

    case 'change_instruction':
    case 'change_note': {
      const field = FIELD_LABEL[entry.action]
      const change = arrow(from, to)
      return {
        title: `${field} diubah`,
        detail: [change, reason].filter(Boolean).join(' — ') || null,
      }
    }

    case 'add_unit':
      if (isUnit) {
        return { title: `${unitLabel} ditambahkan ke order`, detail: reason }
      }
      return {
        title: from
          ? `Jumlah unit ditambah: ${from} → ${to || '-'} unit`
          : `Unit ditambahkan, total ${to || '-'} unit`,
        detail: reason,
      }

    case 'reduce_unit':
      if (isUnit) {
        return { title: `${unitLabel} dibatalkan (pengurangan unit)`, detail: reason }
      }
      return {
        title: from
          ? `Jumlah unit dikurangi: ${from} → ${to || '-'} unit`
          : `Unit dikurangi, total ${to || '-'} unit`,
        detail: reason,
      }

    case 'change_vehicle':
      if (isUnit && !from) {
        return { title: `${unitLabel} pengganti ditambahkan (${to || '-'})`, detail: reason }
      }
      return {
        title: `${isUnit ? `Jenis ${unitLabel.toLowerCase()}` : 'Jenis unit'} diganti: ${arrow(from, to) || '-'}`,
        detail: reason,
      }

    case 'cancel_order':
      return {
        title: isUnit ? `${unitLabel} ikut dibatalkan` : 'Order dibatalkan',
        detail: reason,
      }

    case 'replace_failed_unit':
      return {
        title: `Unit Failed diganti: ${arrow(firstPart(entry.old_value), firstPart(entry.new_value)) || '-'}`,
        detail: reason,
      }

    case 'failed_unit_to_vendor':
      return {
        title: `Unit Failed ${unit || firstPart(entry.old_value, 1) || ''} dialihkan ke Vendor`.replace('  ', ' '),
        detail: reason,
      }

    case 'cancel_failed_unit':
      if (isUnit) {
        return {
          title: `Unit Failed ${unit || firstPart(entry.old_value, 2) || ''} dibatalkan`.replace('  ', ' '),
          detail: reason,
        }
      }
      return {
        title: `Kebutuhan unit dikurangi: ${arrow(from, to) || '-'} unit`,
        detail: reason,
      }

    case 'ready_to_depart':
      return { title: `${unitLabel} Ready to Depart`, detail: reason }

    case 'unit_allocation':
      return (
        summarizeAllocation(entry.new_value) || {
          title: 'Alokasi unit disimpan',
          detail: null,
        }
      )

    case 'reject_change_request':
      return {
        title: from ? `Permintaan "${from}" ditolak` : 'Permintaan perubahan ditolak',
        detail: reason,
      }

    case 'booking_capacity_check':
      return {
        title: `Kapasitas booking dicek: ${status(entry.new_value) || '-'}`,
        detail: reason,
      }

    case 'booking_revised':
      return {
        title: 'Booking direvisi, dikirim ulang untuk cek kapasitas',
        detail: reason,
      }

    case 'booking_approved':
      return { title: 'Booking di-approve, order mulai diproses', detail: reason }

    case 'booking_cancelled':
      return { title: 'Booking dibatalkan', detail: reason }

    default: {
      const label = ACTION_LABEL[entry.action] || humanize(entry.action)
      const change = arrow(status(entry.old_value), status(entry.new_value))
      return {
        title: isUnit && unit ? `${label} — ${unit}` : label,
        detail: [change, reason].filter(Boolean).join(' — ') || null,
      }
    }
  }
}

// Kompatibilitas: kalimat satu baris.
export function getActivityMessage(action: string, newValue: string | null) {
  return describeActivity({ action, new_value: newValue }).title
}
