export type Geofence = {
  id: string
  name: string
  type: 'loading' | 'unloading' | 'other'
  lat: number
  lng: number
  radius_m: number
}

export const FENCE_LABEL: Record<Geofence['type'], string> = {
  loading: 'Area Loading',
  unloading: 'Area Bongkar',
  other: 'Lainnya',
}

export const FENCE_COLOR: Record<Geofence['type'], string> = {
  loading: '#2563eb',
  unloading: '#7c3aed',
  other: '#64748b',
}

// Jarak dua titik koordinat dalam meter (Haversine).
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}