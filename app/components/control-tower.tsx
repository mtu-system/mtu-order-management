'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup, Marker } from 'leaflet'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { normalizePlate } from '@/lib/plate'
import {
  type Geofence,
  FENCE_COLOR,
  FENCE_LABEL,
  distanceMeters,
} from '@/lib/geo'
import { type MonitoringRow, TRIP_BADGE, TRIP_LABEL } from '@/lib/trip-status'
import {
  MOVING_KMH,
  LIVE_MS,
  DRIVE_RED_MIN,
  DRIVE_AMBER_MIN,
} from '@/lib/alert-rules'

type Position = {
  deviceName: string
  lat: number | null
  lng: number | null
  speed: number
  online: boolean
  accOn: boolean
  gpsTime: string | null
}
type Drive = {
  driveMinutes: number
  stoppedMinutes: number
  avgSpeed: number
  maxSpeed: number
  dailyDriveMinutes: number
  overspeedNowSec: number
  overspeedMinutes: number
}
type UnitState = 'moving' | 'idle' | 'stopped' | 'offline'
type Alert = { level: 'red' | 'amber'; text: string }
type DbAlert = {
  plate: string
  kind: string
  level: 'red' | 'amber'
  message: string
}
type Filter = 'all' | 'alert' | UnitState

type Item = {
  row: MonitoringRow
  position: Position | undefined
  state: UnitState
  drive: Drive | undefined
  areaName: string | null
  fence: Geofence | undefined
  remainingKm: number | null
  tripMinutes: number | null
  gpsAgeMinutes: number | null
  alerts: Alert[]
}

const POLL_MS = 30_000

const STATE_LABEL: Record<UnitState, string> = {
  moving: 'Bergerak',
  idle: 'Mesin nyala, diam',
  stopped: 'Berhenti',
  offline: 'Offline',
}

const STATE_COLOR: Record<UnitState, string> = {
  moving: '#059669',
  idle: '#d97706',
  stopped: '#64748b',
  offline: '#cbd5e1',
}

function parseGpsTime(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z')
}

function formatMinutes(minutes: number) {
  const total = Math.round(minutes)
  if (total < 60) return `${total} menit`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stateOf(position: Position | undefined): UnitState {
  if (!position || position.lat === null || position.lng === null) return 'offline'

  const time = position.gpsTime ? parseGpsTime(position.gpsTime).getTime() : 0
  if (!position.online || Date.now() - time > LIVE_MS) return 'offline'

  if (position.speed >= MOVING_KMH) return 'moving'
  return position.accOn ? 'idle' : 'stopped'
}

function wibDate(ms: number) {
  return new Date(ms + 7 * 3600e3).toISOString().slice(0, 10)
}

// Tautan ke Laporan Unit dengan plat dan rentang waktu trip (maks 7 hari).
function reportHref(base: string, row: MonitoringRow) {
  const startIso = row.times.on_going || row.times.finished_loading
  const endIso = row.times.complete || row.times.finished_unloading
  const toMs = endIso ? new Date(endIso).getTime() : Date.now()
  let fromMs = startIso ? new Date(startIso).getTime() : toMs
  fromMs = Math.max(fromMs, toMs - 6 * 86400e3)

  const query = new URLSearchParams({
    plate: row.plateNumber || '',
    from: wibDate(fromMs),
    to: wibDate(toMs),
  })

  return `${base}?${query}`
}

export default function ControlTower({
  rows: initialRows,
  canEdit,
}: {
  rows: MonitoringRow[]
  canEdit: boolean
}) {
  const supabase = createClient()
  const toast = useToast()
  const pathname = usePathname()
  const reportBase = pathname.replace('control-tower', 'unit-report')

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const fenceLayerRef = useRef<LayerGroup | null>(null)
  const markerLayerRef = useRef<LayerGroup | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const fittedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [rows, setRows] = useState(initialRows)
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [drives, setDrives] = useState<Record<string, Drive>>({})
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [dbAlerts, setDbAlerts] = useState<DbAlert[]>([])
  const [failed, setFailed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Peta
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      leafletRef.current = L
      const map = L.map(containerRef.current).setView([-2.5, 118], 5)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      fenceLayerRef.current = L.layerGroup().addTo(map)
      markerLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setReady(true)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Geofence
  useEffect(() => {
    supabase
      .from('geofences')
      .select('id, name, type, lat, lng, radius_m')
      .then(({ data }) => setGeofences((data || []) as Geofence[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Peringatan dari pemeriksa server (overspeed, malam, jam harian)
  useEffect(() => {
    let alive = true

    async function loadAlerts() {
      try {
        if (document.hidden) return
        const response = await fetch('/api/alerts', { cache: 'no-store' })
        if (!response.ok || !alive) return
        const json = await response.json()
        setDbAlerts((json.alerts || []) as DbAlert[])
      } catch {
        // abaikan
      }
    }

    loadAlerts()
    const timer = setInterval(loadAlerts, POLL_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Posisi + durasi mengemudi
  useEffect(() => {
    let alive = true

    async function load() {
      try {
        if (document.hidden) return
        const response = await fetch('/api/tracksolid/locations?drive=1', {
          cache: 'no-store',
        })
        const json = await response.json()
        if (!alive) return

        if (response.ok) {
          setPositions(json.positions || {})
          setDrives(json.drive || {})
          setUpdatedAt(new Date())
          setFailed(false)
        } else {
          setFailed(true)
        }
      } catch {
        if (alive) setFailed(true)
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const items = useMemo<Item[]>(() => {
    const result: Item[] = []

    for (const row of rows) {
      if (row.tripStatus === 'complete' || !row.plateNumber) continue

      const key = normalizePlate(row.plateNumber)
      const position = positions[key]
      const drive = drives[key]
      const state = stateOf(position)

      const here =
        position && position.lat !== null && position.lng !== null
          ? { lat: position.lat, lng: position.lng }
          : null

      const areaName = here
        ? geofences.find((f) => distanceMeters(here, f) <= f.radius_m)?.name ?? null
        : null

      const fence = row.destinationFenceId
        ? geofences.find((f) => f.id === row.destinationFenceId)
        : undefined

      const remainingKm =
        here && fence
          ? Math.max(0, distanceMeters(here, fence) - fence.radius_m) / 1000
          : null

      const tripMinutes =
        row.tripStatus === 'on_going' && row.times.on_going
          ? (Date.now() - new Date(row.times.on_going).getTime()) / 60000
          : null

      const gpsAgeMinutes =
        position?.gpsTime
          ? (Date.now() - parseGpsTime(position.gpsTime).getTime()) / 60000
          : null

      const alerts: Alert[] = []

      if (drive && drive.driveMinutes >= DRIVE_RED_MIN) {
        alerts.push({
          level: 'red',
          text: `Mengemudi ${formatMinutes(drive.driveMinutes)} tanpa istirahat`,
        })
      } else if (drive && drive.driveMinutes >= DRIVE_AMBER_MIN) {
        alerts.push({
          level: 'amber',
          text: `Mendekati 4 jam mengemudi (${formatMinutes(drive.driveMinutes)})`,
        })
      }

      if (row.tripStatus === 'on_going') {
        if (state === 'offline') {
          alerts.push({
            level: 'amber',
            text: position
              ? 'GPS tidak update saat trip berjalan'
              : 'Belum terhubung GPS saat trip berjalan',
          })
        }
      }

      for (const dbAlert of dbAlerts) {
        if (normalizePlate(dbAlert.plate) !== key) continue
        if (
          ['drive_red', 'drive_amber', 'gps_offline', 'stop_outside'].includes(
            dbAlert.kind
          )
        ) {
          continue
        }
        alerts.push({ level: dbAlert.level, text: dbAlert.message })
      }

      result.push({
        row,
        position,
        state,
        drive,
        areaName,
        fence,
        remainingKm,
        tripMinutes,
        gpsAgeMinutes,
        alerts,
      })
    }

    const rank = (item: Item) => {
      if (item.alerts.some((a) => a.level === 'red')) return 0
      if (item.alerts.length > 0) return 1
      return { moving: 2, idle: 3, stopped: 4, offline: 5 }[item.state]
    }

    return result.sort(
      (a, b) =>
        rank(a) - rank(b) || (b.position?.speed ?? 0) - (a.position?.speed ?? 0)
    )
  }, [rows, positions, drives, geofences, dbAlerts])

  const counts = useMemo(() => {
    const result = { moving: 0, idle: 0, stopped: 0, offline: 0, alert: 0 }
    for (const item of items) {
      result[item.state] += 1
      if (item.alerts.length > 0) result.alert += 1
    }
    return result
  }, [items])

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return items.filter((item) => {
      if (filter === 'alert' && item.alerts.length === 0) return false
      if (filter !== 'all' && filter !== 'alert' && item.state !== filter) return false

      if (keyword) {
        const haystack = [
          item.row.plateNumber || '',
          item.row.customer,
          item.row.driverName || '',
          item.row.trip || '',
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [items, filter, search])

  const urgent = items.filter((item) => item.alerts.length > 0).slice(0, 5)

  // Lingkaran geofence
  useEffect(() => {
    const L = leafletRef.current
    const layer = fenceLayerRef.current
    if (!ready || !L || !layer) return

    layer.clearLayers()

    for (const fence of geofences) {
      L.circle([fence.lat, fence.lng], {
        radius: fence.radius_m,
        color: FENCE_COLOR[fence.type],
        weight: 2,
        fillOpacity: 0.12,
      })
        .bindTooltip(`${fence.name} (${FENCE_LABEL[fence.type]})`)
        .addTo(layer)
    }
  }, [ready, geofences])

  // Marker unit
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = markerLayerRef.current
    if (!ready || !L || !map || !layer) return

    layer.clearLayers()
    markersRef.current.clear()

    const points: [number, number][] = []

    for (const item of items) {
      const { position, row } = item
      if (!position || position.lat === null || position.lng === null) continue

      const hasRed = item.alerts.some((a) => a.level === 'red')
      const color = STATE_COLOR[item.state]
      const ring = hasRed
        ? '0 0 0 4px rgba(220,38,38,.55)'
        : '0 1px 4px rgba(0,0,0,.4)'

      const icon = L.divIcon({
        className: '',
        iconSize: [20, 20],
        html: `<div style="width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:${ring}"></div>`,
      })

      const lines = [
        `<strong>${escapeHtml(row.plateNumber || '')}</strong>`,
        escapeHtml(row.customer),
        escapeHtml(row.trip || '-'),
        `Trip: ${escapeHtml(row.tripStatus ? TRIP_LABEL[row.tripStatus] : 'Belum Mulai')}`,
        `${STATE_LABEL[item.state]}${item.state === 'moving' ? ` · ${Math.round(position.speed)} km/j` : ''}`,
      ]

      if (item.drive && item.drive.driveMinutes > 0) {
        lines.push(`Mengemudi: ${formatMinutes(item.drive.driveMinutes)}`)
      }

      if (item.remainingKm !== null && item.fence) {
        lines.push(
          `Sisa ±${item.remainingKm.toFixed(0)} km ke ${escapeHtml(item.fence.name)}`
        )
      }

      for (const alert of item.alerts) lines.push(`⚠ ${escapeHtml(alert.text)}`)

      const marker = L.marker([position.lat, position.lng], { icon }).bindPopup(
        lines.join('<br/>')
      )

      if (showLabels && item.state === 'moving') {
        marker.bindTooltip(
          `${row.plateNumber} · ${Math.round(position.speed)} km/j`,
          { permanent: true, direction: 'top', offset: [0, -10] }
        )
      }

      marker.addTo(layer)
      markersRef.current.set(row.id, marker)
      points.push([position.lat, position.lng])
    }

    if (points.length > 0 && !fittedRef.current) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 12 })
      fittedRef.current = true
    }
  }, [ready, items, showLabels])

  function focusItem(item: Item) {
    setSelectedId(item.row.id)

    const map = mapRef.current
    const position = item.position
    if (!map || !position || position.lat === null || position.lng === null) return

    map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 13))
    markersRef.current.get(item.row.id)?.openPopup()
  }

  async function setDestination(rowId: string, fenceId: string) {
    const value = fenceId || null

    const { data, error } = await supabase
      .from('order_trucks')
      .update({ destination_fence_id: value })
      .eq('id', rowId)
      .select('id')

    if (error || !data || data.length === 0) {
      toast.error('Gagal Menyimpan Tujuan', error?.message || 'Ditolak oleh database.')
      return
    }

    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, destinationFenceId: value } : row
      )
    )
  }

  async function setUrgent(rowId: string, value: boolean) {
    const { data, error } = await supabase
      .from('order_trucks')
      .update({ urgent_shipment: value })
      .eq('id', rowId)
      .select('id')

    if (error || !data || data.length === 0) {
      toast.error('Gagal Menyimpan', error?.message || 'Ditolak oleh database.')
      return
    }

    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, urgentShipment: value } : row
      )
    )
  }

  const unloadingFences = geofences.filter((fence) => fence.type === 'unloading')

  const tiles: { key: Filter; label: string; value: number; tone: string }[] = [
    { key: 'moving', label: 'Bergerak', value: counts.moving, tone: 'text-emerald-600' },
    { key: 'idle', label: 'Mesin nyala, diam', value: counts.idle, tone: 'text-amber-600' },
    { key: 'stopped', label: 'Berhenti', value: counts.stopped, tone: 'text-slate-600' },
    { key: 'offline', label: 'Offline / tanpa GPS', value: counts.offline, tone: 'text-gray-500' },
    { key: 'alert', label: 'Peringatan', value: counts.alert, tone: 'text-red-600' },
  ]

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'alert', label: 'Peringatan' },
    { key: 'moving', label: 'Bergerak' },
    { key: 'idle', label: 'Diam' },
    { key: 'stopped', label: 'Berhenti' },
    { key: 'offline', label: 'Offline' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => setFilter(filter === tile.key ? 'all' : tile.key)}
            className={`rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#2563EB] ${
              filter === tile.key ? 'border-[#2563EB]' : 'border-gray-200'
            }`}
          >
            <p className="text-xs font-semibold text-gray-500">{tile.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${tile.tone}`}>{tile.value}</p>
          </button>
        ))}
      </div>

      {urgent.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-extrabold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            {counts.alert} unit perlu perhatian
          </p>
          <ul className="mt-2 space-y-1 text-xs text-red-900">
            {urgent.map((item) => (
              <li key={item.row.id}>
                <button
                  type="button"
                  onClick={() => focusItem(item)}
                  className="text-left hover:underline"
                >
                  <span className="font-bold">{item.row.plateNumber}</span> ·{' '}
                  {item.row.customer} — {item.alerts[0].text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <div className="flex h-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="space-y-2 border-b border-gray-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari plat, customer, driver..."
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    filter === chip.key
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
            {visibleItems.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-gray-400">
                Tidak ada unit yang cocok.
              </p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.row.id}
                  className={`px-4 py-3 ${
                    selectedId === item.row.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => focusItem(item)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-extrabold text-gray-900">
                        {item.row.plateNumber}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.row.tripStatus
                            ? TRIP_BADGE[item.row.tripStatus]
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.row.tripStatus
                          ? TRIP_LABEL[item.row.tripStatus]
                          : 'Belum Mulai'}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500">
                      {item.row.customer} · {item.row.trip || '-'}
                    </p>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: STATE_COLOR[item.state] }}
                      />
                      {item.position ? STATE_LABEL[item.state] : 'Belum terhubung GPS'}
                      {item.state === 'moving' && item.position && (
                        <span className="font-extrabold">
                          · {Math.round(item.position.speed)} km/j
                        </span>
                      )}
                    </p>

                    <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                      {item.areaName && (
                        <p className="font-semibold text-emerald-700">
                          Di area: {item.areaName}
                        </p>
                      )}
                      {item.drive && item.drive.driveMinutes > 0 && (
                        <p>Mengemudi nonstop: {formatMinutes(item.drive.driveMinutes)}</p>
                      )}
                      {item.drive && item.drive.avgSpeed > 0 && (
                        <p>
                          Kecepatan 24 jam terakhir: rata-rata{' '}
                          {Math.round(item.drive.avgSpeed)} km/j · maks{' '}
                          {Math.round(item.drive.maxSpeed)} km/j
                        </p>
                      )}
                      {item.drive && item.drive.dailyDriveMinutes > 0 && (
                        <p>
                          Total mengemudi 24 jam:{' '}
                          {formatMinutes(item.drive.dailyDriveMinutes)}
                          {item.drive.overspeedMinutes > 0 &&
                            ` · di atas batas ${item.drive.overspeedMinutes} menit`}
                        </p>
                      )}
                      {item.tripMinutes !== null && (
                        <p>Trip berjalan: {formatMinutes(item.tripMinutes)}</p>
                      )}
                      {item.remainingKm !== null && item.fence && (
                        <p>
                          Sisa ±{item.remainingKm.toFixed(0)} km ke {item.fence.name}{' '}
                          (garis lurus)
                        </p>
                      )}
                      {item.gpsAgeMinutes !== null && (
                        <p>GPS update {formatMinutes(item.gpsAgeMinutes)} lalu</p>
                      )}
                    </div>
                  </button>

                  {item.alerts.map((alert) => (
                    <p
                      key={alert.text}
                      className={`mt-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${
                        alert.level === 'red'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {alert.text}
                    </p>
                  ))}

                  <Link
                    href={reportHref(reportBase, item.row)}
                    prefetch={false}
                    className="mt-2 inline-block text-[11px] font-bold text-[#2563EB] hover:underline"
                  >
                    Lihat riwayat perjalanan →
                  </Link>

                  {canEdit && (
                    <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={item.row.urgentShipment}
                        onChange={(event) =>
                          setUrgent(item.row.id, event.target.checked)
                        }
                      />
                      Pengiriman urgent (boleh jalan malam)
                    </label>
                  )}

                  {canEdit && (
                    <select
                      value={item.row.destinationFenceId || ''}
                      onChange={(event) => setDestination(item.row.id, event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700"
                    >
                      <option value="">Tujuan: belum dipilih</option>
                      {unloadingFences.map((fence) => (
                        <option key={fence.id} value={fence.id}>
                          {fence.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5">
            <p className="text-xs text-gray-500">
              {updatedAt
                ? `Diperbarui ${updatedAt.toLocaleTimeString('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : 'Memuat posisi...'}
              {failed && (
                <span className="ml-2 font-semibold text-red-600">GPS gagal dimuat</span>
              )}
            </p>

            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(event) => setShowLabels(event.target.checked)}
              />
              Label kecepatan
            </label>
          </div>

          <div ref={containerRef} className="isolate z-0 h-[596px] w-full" />
        </div>
      </div>
    </div>
  )
}