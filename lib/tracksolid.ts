import crypto from 'crypto'
import { distanceMeters } from '@/lib/geo'
import { SPEED_LIMIT_KMH } from '@/lib/alert-rules'

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

// IMEI → akun pemilik perangkat (dibutuhkan laporan parkir).
const imeiAccount = new Map<string, string>()

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

    for (let r = 0; r < results.length; r++) {
      for (const row of results[r]) {
        const lat = Number(row.lat)
        const lng = Number(row.lng)
        const imei = String(row.imei)

        imeiAccount.set(imei, batch[r])

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

// ===== Laporan unit: rute, jarak tempuh, parkir/idle =====

export type RoutePoint = { lat: number; lng: number; time: string; speed: number }

export type TripItem = {
  start: string
  end: string
  startLat: number | null
  startLng: number | null
  endLat: number | null
  endLng: number | null
  distanceKm: number
  durationSec: number
  avgSpeed: number
}

export type StopItem = {
  start: string
  end: string
  durationSec: number
  lat: number | null
  lng: number | null
  address: string
  acc: 'on' | 'off'
}

export type CallInfo = {
  method: string
  code: number | null
  message: string
  rows: number
}

const MAX_ROUTE_POINTS = 1200

function formatUtc(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

// Waktu TrackSolid "yyyy-MM-dd HH:mm:ss" (UTC) → ISO; format ISO dibiarkan.
function asIso(value: unknown): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text.includes('T')) return text
  return text.replace(' ', 'T') + 'Z'
}

function num(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function diffSeconds(start: string, end: string) {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  return Number.isFinite(a) && Number.isFinite(b) && b > a
    ? Math.round((b - a) / 1000)
    : 0
}

// Struktur respons tiap method sedikit berbeda, jadi cari array yang
// barisnya punya field kunci (di level atas atau satu tingkat di dalam).
function findRows(result: unknown, key: string): Record<string, unknown>[] {
  const candidates: unknown[] = []

  // Kumpulkan array sampai 3 tingkat (mis. data.rows pada laporan parkir).
  function collect(value: unknown, depth: number) {
    candidates.push(value)

    if (depth >= 3 || !value || typeof value !== 'object' || Array.isArray(value)) {
      return
    }

    for (const child of Object.values(value as Record<string, unknown>)) {
      collect(child, depth + 1)
    }
  }

  collect(result, 0)

  for (const candidate of candidates) {
    if (
      Array.isArray(candidate) &&
      candidate.length > 0 &&
      candidate[0] &&
      typeof candidate[0] === 'object' &&
      key in (candidate[0] as object)
    ) {
      return candidate as Record<string, unknown>[]
    }
  }

  return []
}

export async function getUnitReport(imei: string, from: Date, to: Date) {
  const begin = formatUtc(from)
  const end = formatUtc(to)
  const info: CallInfo[] = []

  // Berurutan (bukan paralel) supaya tidak kena "too frequent".
  async function run(
    method: string,
    params: Record<string, string>,
    key: string
  ) {
    try {
      const data = await callAuthed(method, params)
      const rows = data.code === 0 ? findRows(data, key) : []

      info.push({
        method,
        code: data.code,
        message: data.message || '',
        rows: rows.length,
      })

      return rows
    } catch (error) {
      info.push({
        method,
        code: null,
        message: error instanceof Error ? error.message : 'error',
        rows: 0,
      })
      return []
    }
  }

  const trackRows = await run(
    'jimi.device.track.list',
    { imei, begin_time: begin, end_time: end },
    'gpsTime'
  )

  const tripRows = await run(
    'jimi.device.track.mileage',
    { imeis: imei, begin_time: begin, end_time: end },
    'startTime'
  )

  const account = imeiAccount.get(imei) || env('TRACKSOLID_ACCOUNT')

  const parkParams = {
    account,
    imeis: imei,
    start_time: begin,
    end_time: end,
    start_row: '1',
    page_size: '200',
  }

  const parkRows = await run(
    'jimi.open.platform.report.parking',
    { ...parkParams, acc_type: 'off' },
    'startTime'
  )

  const idleRows = await run(
    'jimi.open.platform.report.parking',
    { ...parkParams, acc_type: 'on' },
    'startTime'
  )

  // Titik rute: utamakan GPS (posType 1), buang titik LBS/WiFi yang kasar.
  let points: RoutePoint[] = trackRows
    .map((row) => ({
      lat: num(row.lat),
      lng: num(row.lng),
      time: asIso(row.gpsTime),
      speed: num(row.gpsSpeed),
      posType: String(row.posType ?? ''),
    }))
    .filter((p) => (p.lat !== 0 || p.lng !== 0) && p.time)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((p) => ({ ...p }))
    .filter((p, _i, all) => {
      const hasGps = all.some((x) => x.posType === '1' || x.posType === '')
      return !hasGps || p.posType === '1' || p.posType === ''
    })
    .map(({ lat, lng, time, speed }) => ({ lat, lng, time, speed }))

  const movingSpeeds = points
    .map((p) => p.speed)
    .filter((speed) => speed >= DRIVE_MOVING_KMH)
  const avgSpeed = movingSpeeds.length
    ? movingSpeeds.reduce((sum, speed) => sum + speed, 0) / movingSpeeds.length
    : 0
  const maxSpeed = points.reduce((max, p) => Math.max(max, p.speed), 0)

  let fallbackMeters = 0
  for (let i = 1; i < points.length; i++) {
    fallbackMeters += distanceMeters(points[i - 1], points[i])
  }

  if (points.length > MAX_ROUTE_POINTS) {
    const step = Math.ceil(points.length / MAX_ROUTE_POINTS)
    const last = points[points.length - 1]
    points = points.filter((_p, index) => index % step === 0)
    if (points[points.length - 1] !== last) points.push(last)
  }

  const trips: TripItem[] = tripRows.map((row) => {
    const start = asIso(row.startTime)
    const endTime = asIso(row.endTime)
    const duration =
      num(row.runTimeSecond) || num(row.elapsed) || diffSeconds(start, endTime)

    return {
      start,
      end: endTime,
      startLat: numOrNull(row.startLat),
      startLng: numOrNull(row.startLng),
      endLat: numOrNull(row.endLat),
      endLng: numOrNull(row.endLng),
      distanceKm: num(row.distance) / 1000,
      durationSec: duration,
      avgSpeed: num(row.avgSpeed),
    }
  })

  function toStops(rows: Record<string, unknown>[], acc: 'on' | 'off'): StopItem[] {
    return rows.map((row) => {
      const start = asIso(row.startTime)
      const endTime = asIso(row.endTime)

      return {
        start,
        end: endTime,
        durationSec: num(row.durSecond) || diffSeconds(start, endTime),
        lat: numOrNull(row.lat),
        lng: numOrNull(row.lng),
        address: String(row.addr ?? ''),
        acc,
      }
    })
  }

  let stops = [...toStops(parkRows, 'off'), ...toStops(idleRows, 'on')].sort(
    (a, b) => a.start.localeCompare(b.start)
  )

  // Cadangan: kalau API parkir kosong, turunkan dari jeda antar perjalanan.
  if (parkRows.length === 0 && trips.length > 1) {
    const ordered = [...trips].sort((a, b) => a.start.localeCompare(b.start))
    const derived: StopItem[] = []

    for (let i = 1; i < ordered.length; i++) {
      const gap = diffSeconds(ordered[i - 1].end, ordered[i].start)

      if (gap >= 300) {
        derived.push({
          start: ordered[i - 1].end,
          end: ordered[i].start,
          durationSec: gap,
          lat: ordered[i - 1].endLat,
          lng: ordered[i - 1].endLng,
          address: '(dihitung dari jeda antar perjalanan)',
          acc: 'off',
        })
      }
    }

    stops = derived
  }

  const tripKm = trips.reduce((sum, trip) => sum + trip.distanceKm, 0)

  return {
    points,
    trips,
    stops,
    totalKm: tripKm > 0 ? tripKm : fallbackMeters / 1000,
    avgSpeed,
    maxSpeed,
    info,
  }
}

// ===== Statistik mengemudi dari riwayat rute (24 jam terakhir) =====

export type DriveState = {
  driveMinutes: number // lama mengemudi sejak istirahat terakhir
  stoppedMinutes: number // lama diam sejak terakhir bergerak
  avgSpeed: number
  maxSpeed: number
  dailyDriveMinutes: number // total waktu bergerak dalam 24 jam
  overspeedNowSec: number // lama berturut-turut di atas batas, sampai sekarang
  overspeedMinutes: number // total waktu di atas batas dalam 24 jam
}

const DRIVE_TTL_MS = 3 * 60 * 1000
const DRIVE_LOOKBACK_MS = 24 * 60 * 60 * 1000
const REST_GAP_MS = 30 * 60 * 1000 // berhenti >= 30 menit dianggap istirahat
const DRIVE_MOVING_KMH = 5
const DRIVE_MAX_GAP_MS = 10 * 60 * 1000 // celah data > 10 menit tidak dihitung
const OVERSPEED_GAP_MS = 2 * 60 * 1000
const driveCache = new Map<string, { state: DriveState; fetchedAt: number }>()

async function computeDriveState(imei: string): Promise<DriveState | null> {
  const cached = driveCache.get(imei)
  if (cached && Date.now() - cached.fetchedAt < DRIVE_TTL_MS) return cached.state

  const now = Date.now()

  const data = await callAuthed('jimi.device.track.list', {
    imei,
    begin_time: formatUtc(new Date(now - DRIVE_LOOKBACK_MS)),
    end_time: formatUtc(new Date(now - 5000)),
  })

  if (data.code !== 0) return null

  const samples = findRows(data.result, 'gpsTime')
    .map((row) => ({
      time: new Date(asIso(row.gpsTime)).getTime(),
      speed: num(row.gpsSpeed),
    }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time)

  const movingSamples = samples.filter((s) => s.speed >= DRIVE_MOVING_KMH)
  const moving = movingSamples.map((s) => s.time)

  const avgSpeed = movingSamples.length
    ? movingSamples.reduce((sum, s) => sum + s.speed, 0) / movingSamples.length
    : 0
  const maxSpeed = samples.reduce((max, s) => Math.max(max, s.speed), 0)

  // Mengemudi nonstop sejak istirahat (berhenti >= 30 menit) terakhir.
  let driveMinutes = 0
  let stoppedMinutes = DRIVE_LOOKBACK_MS / 60000

  if (moving.length > 0) {
    let start = moving[0]

    for (let i = 1; i < moving.length; i++) {
      if (moving[i] - moving[i - 1] >= REST_GAP_MS) start = moving[i]
    }

    const last = moving[moving.length - 1]
    stoppedMinutes = Math.round((now - last) / 60000)
    driveMinutes =
      now - last >= REST_GAP_MS ? 0 : Math.round((last - start) / 60000)
  }

  // Total waktu bergerak dan waktu di atas batas kecepatan.
  let dailyMs = 0
  let overspeedMs = 0

  for (let i = 0; i < samples.length - 1; i++) {
    const dt = samples[i + 1].time - samples[i].time
    if (dt <= 0) continue

    if (dt <= DRIVE_MAX_GAP_MS && samples[i].speed >= DRIVE_MOVING_KMH) {
      dailyMs += dt
    }
    if (dt <= OVERSPEED_GAP_MS && samples[i].speed > SPEED_LIMIT_KMH) {
      overspeedMs += dt
    }
  }

  // Lama melaju di atas batas secara berturut-turut sampai titik terakhir.
  let overspeedNowSec = 0
  const lastSample = samples[samples.length - 1]

  if (
    lastSample &&
    now - lastSample.time <= 5 * 60 * 1000 &&
    lastSample.speed > SPEED_LIMIT_KMH
  ) {
    let j = samples.length - 1

    while (
      j > 0 &&
      samples[j - 1].speed > SPEED_LIMIT_KMH &&
      samples[j].time - samples[j - 1].time <= OVERSPEED_GAP_MS
    ) {
      j--
    }

    overspeedNowSec = Math.round((lastSample.time - samples[j].time) / 1000)
  }

  const state: DriveState = {
    driveMinutes,
    stoppedMinutes,
    avgSpeed,
    maxSpeed,
    dailyDriveMinutes: Math.round(dailyMs / 60000),
    overspeedNowSec,
    overspeedMinutes: Math.round(overspeedMs / 60000),
  }

  driveCache.set(imei, { state, fetchedAt: Date.now() })
  return state
}

// Maksimal 3 panggilan sekaligus supaya tidak kena "too frequent".
export async function getDriveStates(imeis: string[]) {
  const result = new Map<string, DriveState>()

  for (let i = 0; i < imeis.length; i += 3) {
    const batch = imeis.slice(i, i + 3)

    const states = await Promise.all(
      batch.map(async (imei) => {
        try {
          return await computeDriveState(imei)
        } catch {
          return null
        }
      })
    )

    batch.forEach((imei, index) => {
      const state = states[index]
      if (state) result.set(imei, state)
    })
  }

  return result
}