import type { SupabaseClient } from '@supabase/supabase-js'
import type { TracksolidDevice } from '@/lib/tracksolid'
import { normalizePlate } from '@/lib/plate'

// Hubungan manual dulu, baru pencocokan nama perangkat.
export async function resolveDevice(
  supabase: SupabaseClient,
  plateKey: string,
  devices: TracksolidDevice[]
): Promise<TracksolidDevice | undefined> {
  const { data: link } = await supabase
    .from('gps_device_links')
    .select('imei')
    .eq('plate_key', plateKey)
    .maybeSingle()

  if (link) {
    const hit = devices.find((device) => device.imei === link.imei)
    if (hit) return hit
  }

  if (plateKey.length < 4) return undefined

  const indexed = devices.map((device) => ({
    device,
    name: normalizePlate(device.deviceName),
  }))

  return (
    indexed.find((item) => item.name === plateKey) ||
    indexed.find((item) => item.name.includes(plateKey))
  )?.device
}

// Plat yang boleh dilihat user ini (dibatasi RLS order_trucks).
export async function loadReportPlates(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from('order_trucks')
    .select('plate_number')
    .not('plate_number', 'is', null)
    .limit(2000)

  const seen = new Map<string, string>()

  for (const row of data || []) {
    const label = String(row.plate_number).trim()
    const key = normalizePlate(label)
    if (key && !seen.has(key)) seen.set(key, label)
  }

  return Array.from(seen.values()).sort()
}