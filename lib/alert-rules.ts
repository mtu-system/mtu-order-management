export const MOVING_KMH = 5
export const LIVE_MS = 30 * 60 * 1000

// Mengemudi nonstop (menit)
export const DRIVE_RED_MIN = 240
export const DRIVE_AMBER_MIN = 210

// Overspeed
export const SPEED_LIMIT_KMH = 80
export const OVERSPEED_MIN_SEC = 120
export const OVERSPEED_LONG_SEC = 600

// Istirahat malam WIB (kecuali pengiriman urgent)
export const NIGHT_START_HOUR = 22
export const NIGHT_END_HOUR = 4
export const NIGHT_GRACE_MIN = 30

// Total mengemudi 24 jam terakhir (menit)
export const DAILY_AMBER_MIN = 420
export const DAILY_RED_MIN = 480

export type AlertKind =
  | 'drive_red'
  | 'drive_amber'
  | 'stop_outside'
  | 'gps_offline'
  | 'overspeed'
  | 'overspeed_long'
  | 'night_driving'
  | 'daily_amber'
  | 'daily_red'

export type AlertCandidate = {
  kind: AlertKind
  level: 'red' | 'amber'
  message: string
}

export const ALERT_LABEL: Record<AlertKind, string> = {
  drive_red: 'Mengemudi lebih dari 4 jam',
  drive_amber: 'Mendekati 4 jam mengemudi',
  stop_outside: 'Berhenti di luar area',
  gps_offline: 'GPS tidak aktif',
  overspeed: 'Overspeed',
  overspeed_long: 'Overspeed berkepanjangan',
  night_driving: 'Jalan di jam istirahat malam',
  daily_amber: 'Mendekati batas jam harian',
  daily_red: 'Melewati batas jam harian',
}

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes)
  if (total < 60) return `${total} menit`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`
}

// Jam istirahat malam: NIGHT_START_HOUR (+ tenggang) sampai NIGHT_END_HOUR WIB.
export function isNightRestWindow(now: Date) {
  const wib = new Date(now.getTime() + 7 * 3600e3)
  const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes()

  return (
    minutes >= NIGHT_START_HOUR * 60 + NIGHT_GRACE_MIN ||
    minutes < NIGHT_END_HOUR * 60
  )
}

export type DriveInfo = {
  driveMinutes: number
  stoppedMinutes: number
  dailyDriveMinutes: number
  overspeedNowSec: number
}

export function evaluateAlerts(input: {
  tripStatus: string | null
  hasDevice: boolean
  live: boolean
  speed: number
  urgent: boolean
  now: Date
  drive: DriveInfo | undefined
}) {
  const candidates: AlertCandidate[] = []
  const { drive } = input

  if (drive) {
    if (drive.driveMinutes >= DRIVE_RED_MIN) {
      candidates.push({
        kind: 'drive_red',
        level: 'red',
        message: `Mengemudi ${formatMinutes(drive.driveMinutes)} tanpa istirahat`,
      })
    } else if (drive.driveMinutes >= DRIVE_AMBER_MIN) {
      candidates.push({
        kind: 'drive_amber',
        level: 'amber',
        message: `Mendekati 4 jam mengemudi (${formatMinutes(drive.driveMinutes)})`,
      })
    }

    if (drive.overspeedNowSec >= OVERSPEED_LONG_SEC) {
      candidates.push({
        kind: 'overspeed_long',
        level: 'red',
        message: `Melaju di atas ${SPEED_LIMIT_KMH} km/j selama ${formatMinutes(drive.overspeedNowSec / 60)} berturut-turut`,
      })
    } else if (drive.overspeedNowSec >= OVERSPEED_MIN_SEC) {
      candidates.push({
        kind: 'overspeed',
        level: 'amber',
        message: `Melaju di atas ${SPEED_LIMIT_KMH} km/j selama ${formatMinutes(drive.overspeedNowSec / 60)} berturut-turut`,
      })
    }

    if (drive.dailyDriveMinutes >= DAILY_RED_MIN) {
      candidates.push({
        kind: 'daily_red',
        level: 'red',
        message: `Total mengemudi 24 jam terakhir ${formatMinutes(drive.dailyDriveMinutes)}`,
      })
    } else if (drive.dailyDriveMinutes >= DAILY_AMBER_MIN) {
      candidates.push({
        kind: 'daily_amber',
        level: 'amber',
        message: `Total mengemudi 24 jam terakhir ${formatMinutes(drive.dailyDriveMinutes)}, mendekati batas`,
      })
    }
  }

  if (
    input.live &&
    input.speed >= MOVING_KMH &&
    !input.urgent &&
    isNightRestWindow(input.now)
  ) {
    const pad = (hour: number) => String(hour).padStart(2, '0')

    candidates.push({
      kind: 'night_driving',
      level: 'red',
      message: `Jalan di jam istirahat malam (${pad(NIGHT_START_HOUR)}:00–${pad(NIGHT_END_HOUR)}:00 WIB), bukan pengiriman urgent`,
    })
  }

  if (input.tripStatus === 'on_going' && !input.live) {
    candidates.push({
      kind: 'gps_offline',
      level: 'amber',
      message: input.hasDevice
        ? 'GPS tidak update saat trip berjalan'
        : 'Belum terhubung GPS saat trip berjalan',
    })
  }

  return { candidates, driveEvaluated: Boolean(drive) }
}