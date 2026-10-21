'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { ExternalLink, Loader2 } from 'lucide-react'
import { upperValue } from '@/lib/upper-value'

type RoutePoint = { lat: number; lng: number; time: string; speed: number }
type TripItem = {
  start: string
  end: string
  distanceKm: number
  durationSec: number
  avgSpeed: number
}
type StopItem = {
  start: string
  end: string
  durationSec: number
  lat: number | null
  lng: number | null
  address: string
  acc: 'on' | 'off'
}
type Report = {
  deviceName: string
  points: RoutePoint[]
  trips: TripItem[]
  stops: StopItem[]
  totalKm: number
  avgSpeed: number
  maxSpeed: number
  info: { method: string; code: number | null; message: string; rows: number }[]
}

const MIN_STOP_SEC = 300

function todayWib(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600e3 - offsetDays * 86400e3)
    .toISOString()
    .slice(0, 10)
}

function formatDateTime(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`
}

function ReportMap({ points, stops }: { points: RoutePoint[]; stops: StopItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const [ready, setReady] = useState(false)

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

      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      setReady(true)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !L || !map || !layer) return

    layer.clearLayers()
    if (points.length === 0) return

    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number])

    L.polyline(latlngs, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(layer)

    L.circleMarker(latlngs[0], {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: '#059669',
      fillOpacity: 1,
    })
      .bindTooltip('Awal')
      .addTo(layer)

    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: '#dc2626',
      fillOpacity: 1,
    })
      .bindTooltip('Akhir')
      .addTo(layer)

    for (const stop of stops) {
      if (stop.lat === null || stop.lng === null) continue
      if (stop.durationSec < MIN_STOP_SEC) continue

      L.circleMarker([stop.lat, stop.lng], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: stop.acc === 'on' ? '#d97706' : '#64748b',
        fillOpacity: 1,
      })
        .bindTooltip(
          `${stop.acc === 'on' ? 'Idle' : 'Parkir'} ${formatDuration(stop.durationSec)}`
        )
        .addTo(layer)
    }

    map.fitBounds(latlngs, { padding: [30, 30] })
  }, [ready, points, stops])

  return <div ref={containerRef} className="isolate z-0 h-[420px] w-full" />
}

export default function UnitReport({
  plates,
  initial,
}: {
  plates: string[]
  initial?: { plate: string; from: string; to: string }
}) {
  const [plate, setPlate] = useState(initial?.plate || '')
  const [fromDate, setFromDate] = useState(initial?.from || todayWib())
  const [toDate, setToDate] = useState(initial?.to || todayWib())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<Report | null>(null)

  function applyPreset(days: number) {
    setFromDate(todayWib(days))
    setToDate(todayWib(days === 1 ? 1 : 0))
  }

  async function handleLoad() {
    if (!plate.trim()) {
      setError('Pilih atau ketik plat unit terlebih dahulu.')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    try {
      const from = new Date(`${fromDate}T00:00:00+07:00`)
      const to = new Date(`${toDate}T23:59:59+07:00`)

      const query = new URLSearchParams({
        plate,
        from: from.toISOString(),
        to: to.toISOString(),
      })

      const response = await fetch(`/api/tracksolid/report?${query}`, {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok) {
        setError(json.error || 'Gagal memuat laporan.')
        return
      }

      setReport(json as Report)
    } catch {
      setError('Gagal memuat laporan. Periksa koneksi lalu coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initial?.plate) handleLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parkTotal = report
    ? report.stops
        .filter((stop) => stop.acc === 'off')
        .reduce((sum, stop) => sum + stop.durationSec, 0)
    : 0
  const idleTotal = report
    ? report.stops
        .filter((stop) => stop.acc === 'on')
        .reduce((sum, stop) => sum + stop.durationSec, 0)
    : 0

  const input =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10'

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Plat Unit</label>
            <input
              list="report-plates"
              value={plate}
              onChange={(event) => setPlate(upperValue(event))}
              placeholder="B 1234 XYZ"
              className={`mt-1.5 ${input}`}
            />
            <datalist id="report-plates">
              {plates.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Dari Tanggal</label>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={`mt-1.5 ${input}`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Sampai Tanggal</label>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={`mt-1.5 ${input}`}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLoad}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#2563EB]/85 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Tampilkan Laporan
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            ['Hari ini', 0],
            ['Kemarin', 1],
            ['3 hari', 2],
            ['7 hari', 6],
          ].map(([label, days]) => (
            <button
              key={label}
              type="button"
              onClick={() => applyPreset(days as number)}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200"
            >
              {label}
            </button>
          ))}
          <span className="ml-1 self-center text-[11px] text-gray-400">
            Maksimal 7 hari per laporan
          </span>
        </div>

        {error && (
          <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
        )}
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-14 text-center text-sm text-gray-400 shadow-sm">
          Mengambil data dari TrackSolid...
        </div>
      )}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Jarak Tempuh', `${report.totalKm.toFixed(1)} km`],
              ['Jumlah Perjalanan', String(report.trips.length)],
              ['Total Parkir (mesin mati)', formatDuration(parkTotal)],
              ['Total Idle (mesin nyala)', formatDuration(idleTotal)],
              ['Kecepatan Rata-rata', `${Math.round(report.avgSpeed)} km/j`],
              ['Kecepatan Maksimum', `${Math.round(report.maxSpeed)} km/j`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <p className="text-xs font-semibold text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <p className="text-sm font-extrabold text-gray-900">
                Rute · {report.deviceName}
              </p>
              <p className="text-[11px] text-gray-400">
                Hijau = awal, merah = akhir, abu = parkir, oranye = idle
              </p>
            </div>

            {report.points.length === 0 ? (
              <p className="px-5 py-14 text-center text-sm text-gray-400">
                Tidak ada data rute pada rentang waktu ini.
              </p>
            ) : (
              <ReportMap points={report.points} stops={report.stops} />
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-900">
              Perjalanan ({report.trips.length})
            </div>
            {report.trips.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                Tidak ada perjalanan tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      {['Mulai', 'Selesai', 'Jarak', 'Durasi', 'Rata-rata'].map((h) => (
                        <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.trips.map((trip, index) => (
                      <tr key={index}>
                        <td className="px-5 py-2.5">{formatDateTime(trip.start)}</td>
                        <td className="px-5 py-2.5">{formatDateTime(trip.end)}</td>
                        <td className="px-5 py-2.5 font-semibold">
                          {trip.distanceKm.toFixed(1)} km
                        </td>
                        <td className="px-5 py-2.5">{formatDuration(trip.durationSec)}</td>
                        <td className="px-5 py-2.5">{Math.round(trip.avgSpeed)} km/j</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-900">
              Titik Berhenti ({report.stops.length})
            </div>
            {report.stops.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                Tidak ada titik berhenti tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      {['Mulai', 'Durasi', 'Jenis', 'Lokasi'].map((h) => (
                        <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.stops.map((stop, index) => (
                      <tr key={index}>
                        <td className="px-5 py-2.5">{formatDateTime(stop.start)}</td>
                        <td className="px-5 py-2.5 font-semibold">
                          {formatDuration(stop.durationSec)}
                        </td>
                        <td className="px-5 py-2.5">
                          {stop.acc === 'on' ? 'Idle (mesin nyala)' : 'Parkir'}
                        </td>
                        <td className="px-5 py-2.5 text-xs text-gray-600">
                          {stop.address || '-'}
                          {stop.lat !== null && stop.lng !== null && (
                            <a
                              href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline"
                            >
                              Peta <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400">
            Diagnostik:{' '}
            {report.info
              .map((call) => `${call.method.split('.').slice(-1)[0]}: code ${call.code ?? 'err'}, ${call.rows} baris`)
              .join(' · ')}
          </p>
        </>
      )}
    </div>
  )
}