'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { normalizePlate } from '@/lib/plate'
import { createClient } from '@/lib/supabase/client'
import { type Geofence, FENCE_COLOR, FENCE_LABEL } from '@/lib/geo'
import {
  type MonitoringRow,
  TRIP_LABEL,
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

const POLL_MS = 30_000
const STALE_MS = 24 * 60 * 60 * 1000

const COLORS: Record<string, string> = {
  none: '#64748b',
  finished_loading: '#2563eb',
  on_going: '#d97706',
  finished_unloading: '#7c3aed',
  complete: '#059669',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function LiveMap({ rows }: { rows: MonitoringRow[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const fenceLayerRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const fittedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [failed, setFailed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [geofences, setGeofences] = useState<Geofence[]>([])

  useEffect(() => {
    createClient()
      .from('geofences')
      .select('id, name, type, lat, lng, radius_m')
      .then(({ data }) => setGeofences((data || []) as Geofence[]))
  }, [])

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

  // Inisialisasi peta sekali.
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
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setReady(true)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // Ambil posisi GPS berkala.
  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const response = await fetch('/api/tracksolid/locations', {
          cache: 'no-store',
        })
        const json = await response.json()
        if (!alive) return

        if (response.ok) {
          setPositions(json.positions || {})
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

  // Gambar ulang marker tiap data berubah.
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !L || !map || !layer) return

    layer.clearLayers()
    const points: [number, number][] = []

    for (const row of rows) {
      if (row.tripStatus === 'complete' || !row.plateNumber) continue

      const position = positions[normalizePlate(row.plateNumber)]
      if (!position || position.lat === null || position.lng === null) continue

      const last = position.gpsTime
        ? new Date(position.gpsTime.replace(' ', 'T') + 'Z')
        : null
      const live = position.online && !!last && Date.now() - last.getTime() < STALE_MS
      const color = COLORS[row.tripStatus ?? 'none']

      const icon = L.divIcon({
        className: '',
        iconSize: [18, 18],
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);opacity:${live ? 1 : 0.45}"></div>`,
      })

      const statusLabel = row.tripStatus ? TRIP_LABEL[row.tripStatus] : 'Belum Mulai'

      L.marker([position.lat, position.lng], { icon })
        .bindPopup(
          `<strong>${escapeHtml(row.plateNumber)}</strong><br/>` +
            `${escapeHtml(row.customer)}<br/>` +
            `${escapeHtml(row.trip || '-')}<br/>` +
            `Status: ${escapeHtml(statusLabel)}<br/>` +
            `${live ? `Online · ${position.speed} km/j` : 'Offline / lama tidak update'}`
        )
        .addTo(layer)

      points.push([position.lat, position.lng])
    }

    if (points.length > 0 && !fittedRef.current) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 13 })
      fittedRef.current = true
    }
  }, [ready, rows, positions])

  const activeRows = rows.filter(
    (row) => row.tripStatus !== 'complete' && row.plateNumber
  )
  const onMap = activeRows.filter((row) => {
    const position = positions[normalizePlate(row.plateNumber || '')]
    return position && position.lat !== null
  }).length

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <p className="text-xs text-gray-500">
          <span className="font-bold text-gray-800">{onMap}</span> dari{' '}
          {activeRows.length} unit aktif terlihat di peta
          {updatedAt &&
            ` · diperbarui ${updatedAt.toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
            })}`}
          {failed && (
            <span className="ml-2 font-semibold text-red-600">
              GPS gagal dimuat
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-gray-600">
          {[
            ['none', 'Belum Mulai'],
            ['finished_loading', 'Finished Loading'],
            ['on_going', 'On Going'],
            ['finished_unloading', 'Finished Unloading'],
          ].map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[key] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="isolate z-0 h-[calc(100vh-260px)] min-h-[420px] w-full"
      />
    </div>
  )
}