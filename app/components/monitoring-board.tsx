'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Search, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { logOrderHistory } from '@/lib/history'
import { normalizePlate } from '@/lib/plate'
import { type Geofence, distanceMeters } from '@/lib/geo'
import {
  type MonitoringRow,
  type TripStatus,
  TRIP_BADGE,
  TRIP_FLOW,
  TRIP_LABEL,
  TRIP_TIME_COLUMN,
  nextTripStatus,
  prevTripStatus,
} from '@/lib/trip-status'

type Position = {
  deviceName: string
  lat: number | null
  lng: number | null
  speed: number
  online: boolean
  accOn: boolean
  gpsTime: string | null
}

type Filter = 'active' | 'none' | TripStatus | 'all'

const POLL_MS = 30_000
const STALE_MS = 24 * 60 * 60 * 1000

// Waktu GPS TrackSolid berformat "yyyy-MM-dd HH:mm:ss" dalam UTC.
function parseGpsTime(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z')
}

function timeAgo(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'baru saja'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

function formatTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function GpsCell({
  plate,
  position,
  gpsFailed,
  areaName,
}: {
  plate: string | null
  position: Position | undefined
  gpsFailed: boolean
  areaName?: string | null
}) {
  if (!plate) return <span className="text-gray-400">-</span>

  if (!position) {
    return (
      <span className="text-xs text-gray-400">
        {gpsFailed ? 'GPS tidak terbaca' : 'Belum terhubung GPS'}
      </span>
    )
  }

  const lastUpdate = position.gpsTime ? parseGpsTime(position.gpsTime) : null
  const isStale =
    !lastUpdate || Date.now() - lastUpdate.getTime() > STALE_MS
  const live = position.online && !isStale

  return (
    <div className="space-y-0.5 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-gray-800">
        <span
          className={`h-2 w-2 rounded-full ${
            live ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        />
        {live ? 'Online' : 'Offline'}
        {live && <span className="font-normal">· {position.speed} km/j</span>}
      </div>

      {lastUpdate && (
        <p className="text-gray-400">Update {timeAgo(lastUpdate)}</p>
      )}

      {live && areaName && (
        <p className="font-semibold text-emerald-700">Di area: {areaName}</p>
      )}

      {position.lat !== null && position.lng !== null && (
        <a
          href={`https://www.google.com/maps?q=${position.lat},${position.lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline"
        >
          Lihat peta
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

export default function MonitoringBoard({
  rows: initialRows,
  canEdit,
}: {
  rows: MonitoringRow[]
  canEdit: boolean
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState(initialRows)
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [gpsFailed, setGpsFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [geofences, setGeofences] = useState<Geofence[]>([])

  useEffect(() => {
    let alive = true

    async function loadPositions() {
      try {
        if (document.hidden) return
        const response = await fetch('/api/tracksolid/locations', {
          cache: 'no-store',
        })
        const json = await response.json()

        if (!alive) return

        if (response.ok) {
          setPositions(json.positions || {})
          setGpsFailed(false)
        } else {
          setGpsFailed(true)
        }
      } catch {
        if (alive) setGpsFailed(true)
      }
    }

    loadPositions()
    const timer = setInterval(loadPositions, POLL_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    supabase
      .from('geofences')
      .select('id, name, type, lat, lng, radius_m')
      .then(({ data }) => setGeofences((data || []) as Geofence[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function areaNameFor(position: Position | undefined): string | null {
    if (!position || position.lat === null || position.lng === null) return null

    const here = { lat: position.lat, lng: position.lng }

    return (
      geofences.find((fence) => distanceMeters(here, fence) <= fence.radius_m)
        ?.name ?? null
    )
  }

  function suggestionFor(
    row: MonitoringRow,
    position: Position | undefined
  ): string | null {
    if (!position || position.lat === null || position.lng === null) return null
    if (!position.online || !position.gpsTime) return null
    if (Date.now() - parseGpsTime(position.gpsTime).getTime() > STALE_MS) {
      return null
    }

    const here = { lat: position.lat, lng: position.lng }
    const inside = (type: Geofence['type']) =>
      geofences.find(
        (fence) => fence.type === type && distanceMeters(here, fence) <= fence.radius_m
      )

    if (row.tripStatus === 'finished_loading') {
      const hasLoadingFence = geofences.some((fence) => fence.type === 'loading')
      if (hasLoadingFence && !inside('loading') && position.speed >= 5) {
        return 'Unit sudah keluar dari area loading. Mungkin sudah On Going.'
      }
    }

    if (row.tripStatus === 'on_going') {
      const fence = inside('unloading')
      if (fence) {
        return `Unit sudah di ${fence.name}. Mungkin sudah Finished Unloading.`
      }
    }

    return null
  }

  const counts = useMemo(() => {
    const result = {
      none: 0,
      finished_loading: 0,
      on_going: 0,
      finished_unloading: 0,
      complete: 0,
    }

    for (const row of rows) {
      result[row.tripStatus ?? 'none'] += 1
    }

    return result
  }, [rows])

  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (filter === 'active' && row.tripStatus === 'complete') return false
      if (filter === 'none' && row.tripStatus !== null) return false
      if (
        filter !== 'active' &&
        filter !== 'none' &&
        filter !== 'all' &&
        row.tripStatus !== filter
      ) {
        return false
      }

      if (keyword) {
        const haystack = [
          row.customer,
          row.pkNumber || '',
          row.rftTrJob || '',
          row.plateNumber || '',
          row.noBuntut || '',
          row.driverName || '',
          row.trip || '',
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [rows, filter, search])

  async function applyStatus(
    row: MonitoringRow,
    target: TripStatus | null,
    mode: 'forward' | 'back'
  ) {
    if (busyId) return

    const fromLabel = row.tripStatus ? TRIP_LABEL[row.tripStatus] : 'Belum Mulai'
    const toLabel = target ? TRIP_LABEL[target] : 'Belum Mulai'

    const confirmed = await confirm({
      title:
        mode === 'forward' ? `Tandai ${toLabel}?` : 'Batalkan Status Terakhir?',
      message: `Unit ${row.plateNumber || row.vehicleType} (${row.customer}): ${fromLabel} → ${toLabel}.`,
      confirmLabel: mode === 'forward' ? 'Ya, Tandai' : 'Ya, Batalkan',
      danger: mode === 'back',
    })

    if (!confirmed) return

    setBusyId(row.id)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const now = new Date().toISOString()

      const patch: Record<string, string | null> = {
        trip_status: target,
        trip_status_updated_by: user?.id || null,
      }

      if (mode === 'forward' && target) {
        patch[TRIP_TIME_COLUMN[target]] = now
      }

      if (mode === 'back' && row.tripStatus) {
        patch[TRIP_TIME_COLUMN[row.tripStatus]] = null
      }

      const { data, error } = await supabase
        .from('order_trucks')
        .update(patch)
        .eq('id', row.id)
        .select('id')

      if (error) {
        console.error('UPDATE TRIP STATUS ERROR:', error)
        toast.error('Gagal Mengubah Status', error.message)
        return
      }

      if (!data || data.length === 0) {
        toast.error(
          'Tidak Diizinkan',
          'Perubahan ditolak oleh database. Cek hak akses akun ini.'
        )
        return
      }

      await logOrderHistory({
        orderId: row.orderId,
        action: 'trip_status_changed',
        fieldName: 'trip_status',
        oldValue: fromLabel,
        newValue: toLabel,
        reason: `Unit ${row.plateNumber || '-'} (${row.vehicleType})`,
        changedBy: user?.id || null,
      })

      setRows((current) =>
        current.map((item) => {
          if (item.id !== row.id) return item

          const times = { ...item.times }
          if (mode === 'forward' && target) times[target] = now
          if (mode === 'back' && row.tripStatus) times[row.tripStatus] = null

          return { ...item, tripStatus: target, times }
        })
      )

      toast.success('Status Diperbarui', `${toLabel} untuk unit ini.`)
    } catch (error) {
      console.error('UPDATE TRIP STATUS ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'active', label: 'Aktif' },
    { key: 'none', label: 'Belum Mulai', count: counts.none },
    ...TRIP_FLOW.map((status) => ({
      key: status as Filter,
      label: TRIP_LABEL[status],
      count: counts[status],
    })),
    { key: 'all', label: 'Semua' },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari customer, PK, plat, driver..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === chip.key
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {chip.label}
              {chip.count !== undefined ? ` (${chip.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-gray-200 px-6 py-2 text-xs text-gray-400">
        Menampilkan {visibleRows.length} dari {rows.length} unit · posisi GPS
        diperbarui otomatis tiap 30 detik
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {['Order', 'Unit', 'Status', 'GPS', ...(canEdit ? ['Aksi'] : [])].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 5 : 4}
                  className="px-5 py-14 text-center text-sm text-gray-400"
                >
                  Tidak ada unit yang cocok dengan filter ini.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const next = nextTripStatus(row.tripStatus)
                const prev = prevTripStatus(row.tripStatus)
                const busy = busyId === row.id
                const position = row.plateNumber
                  ? positions[normalizePlate(row.plateNumber)]
                  : undefined

                return (
                  <tr key={row.id} className="align-top hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900">{row.customer}</p>
                      <p className="text-[11px] text-gray-400">
                        {row.pkNumber || row.rftTrJob || '-'}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {row.trip || '-'}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900">
                        {row.plateNumber || '-'}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {row.vehicleType}
                        {row.noBuntut ? ` · Buntut ${row.noBuntut}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {row.source === 'vendor'
                          ? `Vendor${row.vendorName ? ` · ${row.vendorName}` : ''}`
                          : row.driverName || '-'}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      {row.tripStatus ? (
                        <>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${TRIP_BADGE[row.tripStatus]}`}
                          >
                            {TRIP_LABEL[row.tripStatus]}
                          </span>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {formatTime(row.times[row.tripStatus])}
                          </p>
                          {suggestionFor(row, position) && (
                            <p className="mt-1.5 max-w-[220px] rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                              {suggestionFor(row, position)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
                          Belum Mulai
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <GpsCell
                        plate={row.plateNumber}
                        position={position}
                        gpsFailed={gpsFailed}
                        areaName={areaNameFor(position)}
                      />
                    </td>

                    {canEdit && (
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1.5">
                          {next ? (
                            <button
                              type="button"
                              onClick={() => applyStatus(row, next, 'forward')}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2563EB]/85 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              Tandai {TRIP_LABEL[next]}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-700">
                              Selesai
                            </span>
                          )}

                          {row.tripStatus && (
                            <button
                              type="button"
                              onClick={() => applyStatus(row, prev, 'back')}
                              disabled={busy}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 transition hover:text-red-600 disabled:opacity-50"
                            >
                              <Undo2 className="h-3 w-3" />
                              Batalkan status terakhir
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}