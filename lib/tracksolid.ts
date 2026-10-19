import crypto from 'crypto'

const BASE_URL =
  process.env.TRACKSOLID_BASE_URL ||
  'https://hk-open.tracksolidpro.com/route/rest'

export type TracksolidDevice = {
  imei: string
  deviceName: string
  lat: number | null
  lng: number | null
  speed: number
  online: boolean
  accOn: boolean
  direction: number
  gpsTime: string | null
}

type TokenCache = { token: string; expiresAt: number } | null
let tokenCache: TokenCache = null

type AccountsCache = { accounts: string[]; fetchedAt: number } | null
let accountsCache: AccountsCache = null

type LocationCache = { devices: TracksolidDevice[]; fetchedAt: number } | null
let locationCache: LocationCache = null

const LOCATION_TTL_MS = 30_000
const ACCOUNTS_TTL_MS = 10 * 60 * 1000
const BATCH_SIZE = 5
const MAX_DEPTH = 3

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Env ${name} belum diisi.`)
  return value
}

// Timestamp UTC format yyyy-MM-dd HH:mm:ss (toleransi +-10 menit).
function utcTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// Urutkan parameter, gabung key+value, bungkus dengan secret, MD5, huruf besar.
function signParams(params: Record<string, string>, secret: string) {
  const base = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join('')

  return crypto
    .createHash('md5')
    .update(secret + base + secret, 'utf8')
    .digest('hex')
    .toUpperCase()
}

type ApiResponse = {
  code: number
  message?: string
  result?: unknown
}

async function callApi(
  method: string,
  extra: Record<string, string>
): Promise<ApiResponse> {
  const params: Record<string, string> = {
    method,
    timestamp: utcTimestamp(),
    app_key: env('TRACKSOLID_APP_KEY'),
    sign_method: 'md5',
    v: '1.0',
    format: 'json',
    ...extra,
  }

  const body = new URLSearchParams({
    ...params,
    sign: signParams(params, env('TRACKSOLID_APP_SECRET')),
  })

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`TrackSolid HTTP ${response.status}`)
  }

  return (await response.json()) as ApiResponse
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  const data = await callApi('jimi.oauth.token.get', {
    user_id: env('TRACKSOLID_ACCOUNT'),
    user_pwd_md5: env('TRACKSOLID_USER_PWD_MD5'),
    expires_in: '7200',
  })

  if (data.code !== 0) {
    throw new Error(`TrackSolid token gagal (code ${data.code}): ${data.message}`)
  }

  const result = data.result as { accessToken: string; expiresIn?: number }
  const lifetimeSeconds = Number(result.expiresIn) || 7200

  tokenCache = {
    token: result.accessToken,
    // Sisakan 5 menit supaya tidak dipakai saat hampir kedaluwarsa.
    expiresAt: Date.now() + Math.max(lifetimeSeconds - 300, 60) * 1000,
  }

  return tokenCache.token
}

// Panggil API yang butuh token. Kalau token ditolak (1004), ambil token
// baru lalu coba sekali lagi.
async function callAuthed(
  method: string,
  extra: Record<string, string>
): Promise<ApiResponse> {
  let data = await callApi(method, {
    access_token: await getAccessToken(),
    ...extra,
  })

  if (data.code === 1004) {
    tokenCache = null
    data = await callApi(method, {
      access_token: await getAccessToken(true),
      ...extra,
    })
  }

  return data
}

async function listChildAccounts(parent: string): Promise<string[]> {
  const data = await callAuthed('jimi.user.child.list', { target: parent })

  if (data.code !== 0) {
    throw new Error(
      `TrackSolid daftar sub-akun gagal (code ${data.code}): ${data.message}`
    )
  }

  const rows = Array.isArray(data.result)
    ? (data.result as { account?: string }[])
    : []

  return rows
    .map((row) => row.account)
    .filter((account): account is string => Boolean(account))
}

// Akun utama + semua sub-akun di bawahnya (maksimal MAX_DEPTH tingkat).
// Unit truk biasanya ada di sub-akun, bukan di akun utama.
async function getAllAccounts(): Promise<string[]> {
  if (accountsCache && Date.now() - accountsCache.fetchedAt < ACCOUNTS_TTL_MS) {
    return accountsCache.accounts
  }

  const root = env('TRACKSOLID_ACCOUNT')
  const seen = new Set<string>([root])
  let frontier = [root]

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []

    for (const parent of frontier) {
      const children = await listChildAccounts(parent)

      for (const child of children) {
        if (!seen.has(child)) {
          seen.add(child)
          next.push(child)
        }
      }
    }

    frontier = next
  }

  const accounts = Array.from(seen)
  accountsCache = { accounts, fetchedAt: Date.now() }
  return accounts
}

type RawLocation = {
  imei: string
  deviceName?: string
  lat?: string | number
  lng?: string | number
  speed?: string | number
  status?: string | number
  accStatus?: string | number
  direction?: string | number
  gpsTime?: string
}

async function fetchAccountLocations(account: string): Promise<RawLocation[]> {
  const data = await callAuthed('jimi.user.device.location.list', {
    target: account,
  })

  if (data.code !== 0) {
    // Satu sub-akun bermasalah jangan menggagalkan semuanya.
    console.error(
      `TRACKSOLID LOKASI GAGAL (${account}): code ${data.code} ${data.message}`
    )
    return []
  }

  return Array.isArray(data.result) ? (data.result as RawLocation[]) : []
}

async function fetchLocations(): Promise<TracksolidDevice[]> {
  const accounts = await getAllAccounts()
  const byImei = new Map<string, TracksolidDevice>()

  // Dibatasi BATCH_SIZE panggilan sekaligus supaya tidak kena "too frequent".
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(fetchAccountLocations))

    for (const rows of results) {
      for (const row of rows) {
        const lat = Number(row.lat)
        const lng = Number(row.lng)
        const imei = String(row.imei)

        byImei.set(imei, {
          imei,
          deviceName: row.deviceName || '',
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          speed: Number(row.speed) || 0,
          online: String(row.status) === '1',
          accOn: String(row.accStatus) === '1',
          direction: Number(row.direction) || 0,
          gpsTime: row.gpsTime || null,
        })
      }
    }
  }

  return Array.from(byImei.values())
}

// Dicache 30 detik supaya banyak orang membuka halaman monitoring
// tidak membuat kita kena batas frekuensi TrackSolid (code 1006).
export async function getDeviceLocations(): Promise<TracksolidDevice[]> {
  if (locationCache && Date.now() - locationCache.fetchedAt < LOCATION_TTL_MS) {
    return locationCache.devices
  }

  const devices = await fetchLocations()
  locationCache = { devices, fetchedAt: Date.now() }
  return devices
}

// "B 1234 XYZ", "b-1234-xyz" dan "B1234XYZ" dianggap sama.
export function normalizePlate(value: string | null | undefined) {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// SEMENTARA: dipakai untuk diagnosa. Hanya mengembalikan bentuk data
// (jumlah & nama field), bukan isi datanya. Hapus setelah monitoring jadi.
export async function debugTracksolid() {
  const accounts = await getAllAccounts()
  const devices = await getDeviceLocations()

  return {
    accountCount: accounts.length,
    deviceCount: devices.length,
    withCoordinates: devices.filter((d) => d.lat !== null && d.lng !== null)
      .length,
    online: devices.filter((d) => d.online).length,
    sampleKeys: devices[0] ? Object.keys(devices[0]) : null,
  }
}