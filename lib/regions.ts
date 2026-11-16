// ==========================================
// WILAYAH: ZONA DALAM KOTA & PULAU
// ==========================================
// Batas disederhanakan (beberapa titik per wilayah), cukup untuk
// mengelompokkan unit karena antar pulau dipisah laut. Koordinat [lng, lat].
// Kalau batas perlu disetel, ubah di sini saja.

export type RegionId =
  | 'dalam_kota'
  | 'jawa'
  | 'sumatera'
  | 'kalimantan'
  | 'sulawesi'
  | 'bali_nt'
  | 'maluku_papua'

export const REGION_LABEL: Record<RegionId, string> = {
  dalam_kota: 'Dalam Kota',
  jawa: 'Jawa (luar kota)',
  sumatera: 'Sumatera',
  kalimantan: 'Kalimantan',
  sulawesi: 'Sulawesi',
  bali_nt: 'Bali & Nusa Tenggara',
  maluku_papua: 'Maluku & Papua',
}

export const REGION_ORDER: RegionId[] = [
  'dalam_kota',
  'jawa',
  'sumatera',
  'kalimantan',
  'sulawesi',
  'bali_nt',
  'maluku_papua',
]

type Polygon = [number, number][]

// Zona "dalam kota": Jakarta, Bogor, Depok, Tangerang, Bekasi, Cikarang,
// Karawang, Serang (sampai Cilegon/Merak). Di luar zona ini = luar kota.
export const DALAM_KOTA_ZONE: Polygon = [
  [105.95, -5.85],
  [106.7, -5.85],
  [107.65, -5.85],
  [107.65, -6.25],
  [107.6, -6.6],
  [107.2, -6.7],
  [106.95, -6.8],
  [106.45, -6.8],
  [106.4, -6.4],
  [106.0, -6.3],
  [105.85, -6.0],
]

// Urutan penting: Jawa dicek lebih dulu (Selat Sunda & Selat Bali sempit).
const ISLANDS: { id: Exclude<RegionId, 'dalam_kota'>; polygon: Polygon }[] = [
  {
    id: 'jawa',
    polygon: [
      [105.15, -6.6],
      [105.8, -6.15],
      [105.95, -5.9],
      [106.2, -5.7],
      [106.7, -5.7],
      [108.3, -6.1],
      [110.4, -6.6],
      [112.6, -6.6],
      [114.2, -6.6],
      [114.42, -7.6],
      [114.42, -8.9],
      [112.0, -8.6],
      [110.0, -8.4],
      [108.0, -8.0],
      [106.3, -7.6],
      [105.1, -7.0],
      [105.1, -6.75],
    ],
  },
  {
    id: 'sumatera',
    polygon: [
      [94.8, 6.2],
      [98.0, 6.0],
      [100.5, 4.5],
      [104.2, 1.6],
      [105.0, 1.3],
      [106.3, -0.5],
      [108.6, -2.0],
      [108.6, -3.6],
      [106.3, -4.3],
      [105.95, -5.0],
      [105.85, -5.85],
      [104.3, -6.2],
      [101.5, -4.5],
      [99.0, -1.5],
      [96.5, 1.0],
      [94.8, 3.5],
    ],
  },
  {
    id: 'kalimantan',
    polygon: [
      [108.6, -0.2],
      [109.3, 2.1],
      [111.0, 3.0],
      [114.0, 4.5],
      [115.5, 5.5],
      [117.5, 7.2],
      [119.5, 5.2],
      [118.5, 3.5],
      [118.3, 1.0],
      [117.8, 0.0],
      [116.9, -1.5],
      [116.6, -3.0],
      [116.4, -4.2],
      [114.5, -4.2],
      [111.5, -3.6],
      [110.0, -3.0],
      [109.0, -1.5],
    ],
  },
  {
    id: 'sulawesi',
    polygon: [
      [118.7, -3.0],
      [119.3, -0.5],
      [120.5, 1.3],
      [122.5, 1.3],
      [125.5, 1.8],
      [125.5, 0.3],
      [123.5, 0.2],
      [121.5, -0.8],
      [123.5, -0.8],
      [123.5, -2.0],
      [122.0, -3.0],
      [123.5, -4.5],
      [123.5, -5.8],
      [122.0, -6.0],
      [120.5, -6.6],
      [119.3, -5.8],
      [119.2, -4.0],
    ],
  },
  {
    id: 'bali_nt',
    polygon: [
      [114.43, -7.9],
      [125.2, -7.9],
      [125.2, -10.5],
      [123.5, -11.2],
      [119.0, -11.0],
      [114.43, -9.2],
    ],
  },
  {
    id: 'maluku_papua',
    polygon: [
      [125.6, 3.0],
      [141.1, 3.0],
      [141.1, -9.2],
      [125.6, -9.2],
    ],
  },
]

// Ray casting.
function inPolygon(lat: number, lng: number, polygon: Polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

export function isDalamKota(lat: number, lng: number) {
  return inPolygon(lat, lng, DALAM_KOTA_ZONE)
}

export function islandOf(lat: number, lng: number): Exclude<RegionId, 'dalam_kota'> {
  for (const island of ISLANDS) {
    if (inPolygon(lat, lng, island.polygon)) return island.id
  }

  // Di luar semua batas (mis. di kapal penyeberangan): pulau terdekat.
  let best = ISLANDS[0].id
  let bestDist = Infinity
  for (const island of ISLANDS) {
    for (const [x, y] of island.polygon) {
      const d = (x - lng) ** 2 + (y - lat) ** 2
      if (d < bestDist) {
        bestDist = d
        best = island.id
      }
    }
  }
  return best
}

export function regionOf(lat: number, lng: number): RegionId {
  if (isDalamKota(lat, lng)) return 'dalam_kota'
  return islandOf(lat, lng)
}
