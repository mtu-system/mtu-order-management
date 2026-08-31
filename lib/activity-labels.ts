export const actorLabel: Record<string, string> = {
  create_order: 'Marketing',
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
  hse_inspection: 'HSE',
  ready_to_depart: 'Operational',
  reject_change_request: 'Operational',
}

export const activityMessage: Record<string, string> = {
  create_order: 'Order baru dibuat',
  reduce_unit: 'Unit dikurangi dari order',
  add_unit: 'Unit ditambahkan ke order',
  change_vehicle: 'Jenis unit diganti',
  change_trip: 'Trip diubah',
  change_pk: 'Nomor PK diubah',
  change_rft: 'RFT/TR/Job diubah',
  change_customer: 'Customer diubah',
  change_instruction: 'Instruksi diubah',
  change_note: 'Catatan diubah',
  cancel_order: 'Order dibatalkan',
  replace_failed_unit: 'Detail unit Failed diganti',
  failed_unit_to_vendor: 'Unit Failed dialihkan ke Vendor',
  cancel_failed_unit: 'Unit Failed dibatalkan',
  hse_inspection: 'Pemeriksaan HSE',
  ready_to_depart: 'SJ & UJ dikonfirmasi, unit Ready to Depart',
  reject_change_request: 'Permintaan perubahan ditolak',
}

export function getActivityMessage(action: string, newValue: string | null) {
  if (action === 'hse_inspection' && newValue) {
    return `Pemeriksaan HSE — ${newValue}`
  }
  return activityMessage[action] || action
}