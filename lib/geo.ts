export type Geofence = {
  id: string
  name: string
  type: 'loading' | 'unloading' | 'other' | 'pool'
  lat: number
  lng: number
  radius_m: number
}

export const FENCE_LABEL: Record<Geofence['type'], string> = {
  loading: 'Area Loading',
  unloading: 'Area Bongkar',
  other: 'Lainnya',
  pool: 'Pool',
}

export const FENCE_COLOR: Record<Geofence['type'], string> = {
  loading: '#2563eb',
  unloading: '#7c3aed',
  other: '#64748b',
  pool: '#e30613',
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
// Ambil koordinat dari teks: link Google Maps (…/@lat,lng…, !3dlat!4dlng,
// ?q=lat,lng) atau koordinat biasa "-6.2, 106.9".
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  let value = text.trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    // biarkan apa adanya
  }

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/,
    // .../maps/place/-6.23,106.99 atau .../maps/search/-6.23,+106.99 (titik yang dicari/di-pin)
    /\/(?:place|search)\/(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(value)
    if (!match) continue
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }

  return null
}

const FENCE_TYPES: Geofence['type'][] = ['loading', 'unloading', 'other', 'pool']

// Isi awal form geofence dari query (?lat=&lng=&name=&type=), mis. dari
// tombol "Jadikan Geofence" di Laporan Unit.
export function parseFencePrefill(query: {
  lat?: string
  lng?: string
  name?: string
  type?: string
}) {
  const lat = Number(query.lat)
  const lng = Number(query.lng)
  if (!query.lat || !query.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const type = FENCE_TYPES.includes(query.type as Geofence['type'])
    ? (query.type as Geofence['type'])
    : undefined

  return { lat, lng, name: (query.name || '').slice(0, 80) || undefined, type }
}
