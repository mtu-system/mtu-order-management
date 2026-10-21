export const MOVING_KMH = 5
export const LIVE_MS = 30 * 60 * 1000
export const DRIVE_RED_MIN = 240
export const DRIVE_AMBER_MIN = 210
export const STOP_ALERT_MIN = 120

export type AlertKind =
  | 'drive_red'
  | 'drive_amber'
  | 'stop_outside'
  | 'gps_offline'

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
}

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes)
  if (total < 60) return `${total} menit`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`
}

export function evaluateAlerts(input: {
  tripStatus: string | null
  hasDevice: boolean
  live: boolean
  inArea: boolean
  drive: { driveMinutes: number; stoppedMinutes: number } | undefined
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