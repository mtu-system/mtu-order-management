'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { distanceMeters, type Geofence } from '@/lib/geo'
import { FILL_TRUCK_COLUMNS, fillTruckTimesFromGps, loadImeiByPlate, type FillResult } from '@/lib/trip-times'

// Lokasi muat / bongkar order (geofence). Marketing tidak punya hak tulis
// tabel geofences lewat RLS, jadi lokasi baru dari Create Order dibuat di
// sini (service role) dengan cek role + cek tumpang tindih.

const LOCATION_ROLES = ['marketing', 'marketing_admin', 'manager', 'operational'] as const
const REPORT_ROLES = ['operational', 'manager'] as const
const DEFAULT_RADIUS_M = 500
const MAX_FILL_UNITS = 30

export type LocationType = 'loading' | 'unloading'

export type CreateLocationResult =
  | { ok: true; fence: Geofence }
  | { ok: false; message: string; existing?: Geofence }

export async function createOrderLocation(input: {
  name: string
  type: LocationType
  lat: number
  lng: number
  radius?: number
  force?: boolean
}): Promise<CreateLocationResult> {
  const user = await requireRole([...LOCATION_ROLES])

  const name = (input.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (name.length < 2) return { ok: false, message: 'Nama lokasi wajib diisi.' }
  if (input.type !== 'loading' && input.type !== 'unloading') return { ok: false, message: 'Tipe lokasi tidak valid.' }
  const lat = Number(input.lat)
  const lng = Number(input.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, message: 'Koordinat tidak valid.' }
  }
  const radius = Math.round(Math.min(3000, Math.max(100, Number(input.radius) || DEFAULT_RADIUS_M)))

  const admin = createAdminClient()
  const { data: fences, error: fencesError } = await admin
    .from('geofences')
    .select('id, name, type, lat, lng, radius_m')
  if (fencesError) return { ok: false, message: fencesError.message }

  // Geofence bertumpuk dengan tipe sama bikin status otomatis rancu.
  if (!input.force) {
    const overlap = ((fences || []) as Geofence[])
      .filter((fence) => fence.type === input.type)
      .map((fence) => ({ fence, meters: distanceMeters({ lat, lng }, fence) }))
      .filter(({ fence, meters }) => meters < fence.radius_m + radius)
      .sort((a, b) => a.meters - b.meters)[0]
    if (overlap) {
      return {
        ok: false,
        existing: overlap.fence,
        message: `Sudah ada lokasi "${overlap.fence.name}" ${Math.round(overlap.meters)} m dari titik ini.`,
      }
    }
  }

  const { data, error } = await admin
    .from('geofences')
    .insert({ name, type: input.type, lat, lng, radius_m: radius, created_by: user.id })
    .select('id, name, type, lat, lng, radius_m')
    .single()

  if (error) return { ok: false, message: error.message }

  revalidatePath('/manager/geofences')
  revalidatePath('/operational/geofences')
  return { ok: true, fence: data as Geofence }
}

export type ActionResult = { ok: true } | { ok: false; message: string }

// Lokasi muat/bongkar untuk semua order dalam satu RFT (halaman Update
// Customer). Trigger DB meneruskannya ke unit yang belum punya override.
export async function setOrdersLocations(
  orderIds: string[],
  locations: { origin: string | null; destination: string | null }
): Promise<ActionResult> {
  const user = await requireRole([...REPORT_ROLES])
  const ids = Array.from(new Set(orderIds.map(String))).slice(0, 200)
  if (ids.length === 0) return { ok: false, message: 'Order tidak ditemukan.' }

  const admin = createAdminClient()
  const fenceIds = [locations.origin, locations.destination].filter(Boolean) as string[]
  const { data: fences } = fenceIds.length
    ? await admin.from('geofences').select('id, name').in('id', fenceIds)
    : { data: [] as { id: string; name: string }[] }
  const nameOf = new Map((fences || []).map((fence) => [String(fence.id), fence.name as string]))
  if (fenceIds.some((id) => !nameOf.has(id))) return { ok: false, message: 'Lokasi tidak ditemukan.' }

  const { error } = await admin
    .from('orders')
    .update({ origin_fence_id: locations.origin, destination_fence_id: locations.destination })
    .in('id', ids)
  if (error) {
    return {
      ok: false,
      message: /origin_fence_id|destination_fence_id/.test(error.message)
        ? 'Jalankan migrasi 20261120_order_locations.sql dulu.'
        : error.message,
    }
  }

  const text = `Muat: ${locations.origin ? nameOf.get(locations.origin) : '-'} · Bongkar: ${
    locations.destination ? nameOf.get(locations.destination) : '-'
  }`
  await admin.from('order_history').insert(
    ids.map((id) => ({
      order_id: id,
      action: 'order_locations_updated',
      field_name: 'locations',
      old_value: null,
      new_value: text,
      reason: null,
      changed_by: user.id,
    }))
  )

  revalidatePath('/operational/monitoring-report')
  revalidatePath('/manager/monitoring-report')
  return { ok: true }
}

export type FillGpsResult =
  | { ok: true; results: FillResult[] }
  | { ok: false; message: string }

// Tombol "Isi dari GPS": isi jam yang masih kosong dari riwayat rute.
export async function fillTimesFromGps(truckIds: string[]): Promise<FillGpsResult> {
  const user = await requireRole([...REPORT_ROLES])
  const ids = Array.from(new Set(truckIds.map(String))).slice(0, MAX_FILL_UNITS)
  if (ids.length === 0) return { ok: false, message: 'Tidak ada unit.' }

  const admin = createAdminClient()
  const [trucksRes, fencesRes] = await Promise.all([
    admin.from('order_trucks').select(FILL_TRUCK_COLUMNS).in('id', ids),
    admin.from('geofences').select('id, name, type, lat, lng, radius_m'),
  ])
  if (trucksRes.error) {
    return {
      ok: false,
      message: /origin_fence_id|gps_times_filled_at/.test(trucksRes.error.message)
        ? 'Jalankan migrasi 20261120_order_locations.sql dulu.'
        : trucksRes.error.message,
    }
  }

  const trucks = (trucksRes.data || []) as unknown as Parameters<typeof fillTruckTimesFromGps>[1][]
  const fences = (fencesRes.data || []) as Geofence[]
  const imeiByPlate = await loadImeiByPlate(admin, trucks.map((truck) => truck.plate_number))

  const results: FillResult[] = []
  for (const truck of trucks) {
    results.push(await fillTruckTimesFromGps(admin, truck, { fences, imeiByPlate }, user.id))
  }

  revalidatePath('/operational/monitoring-report')
  revalidatePath('/manager/monitoring-report')
  return { ok: true, results }
}
