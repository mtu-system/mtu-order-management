'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Minus,
  Search,
  Warehouse,
} from 'lucide-react'
import { type FleetResponse, type FleetUnit, JOURNEY_LABEL, RELOADED_SHOW_MS, TREND_MIN_KM } from '@/lib/fleet'
import { REGION_LABEL, REGION_ORDER, type RegionId } from '@/lib/regions'
import { TRIP_LABEL, type TripStatus } from '@/lib/trip-status'

const POLL_MS = 60_000
// Cron dianggap macet kalau status perjalanan tidak diperbarui > 20 menit.
const JOURNEY_STALE_MS = 20 * 60 * 1000

const GPS_LABEL: Record<FleetUnit['gps'], string> = {
  moving: 'Jalan',
  idle: 'Diam (mesin nyala)',
  stopped: 'Parkir',
  offline: 'Offline',
}

const GPS_DOT: Record<FleetUnit['gps'], string> = {
  moving: 'bg-emerald-500',
  idle: 'bg-amber-500',
  stopped: 'bg-slate-400',
  offline: 'bg-slate-200',
}

function formatEta(iso: string | null, now: number) {
  if (!iso) return '-'
  const date = new Date(iso)
  const diffMin = Math.round((date.getTime() - now) / 60000)
  if (diffMin < 60) return `±${Math.max(diffMin, 1)} menit`

  const time = date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  })
  const dayOf = (ms: number) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10)
  const days = Math.round(
    (new Date(dayOf(date.getTime())).getTime() - new Date(dayOf(now)).getTime()) / 86400e3
  )
  if (days === 0) return `hari ini ${time}`
  if (days === 1) return `besok ${time}`
  return `${date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  })} ${time}`
}

function formatAgo(iso: string | null, now: number) {
  if (!iso) return '-'
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return `${Math.max(minutes, 0)} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

function tripText(unit: FleetUnit) {
  if (!unit.trip) return null
  const status = unit.trip.tripStatus
    ? TRIP_LABEL[unit.trip.tripStatus as TripStatus] || unit.trip.tripStatus
    : 'Belum muat'
  return `${status} · ${unit.trip.customer || '-'}`
}

function Trend({ km }: { km: number | null }) {
  if (km === null) return <span className="text-slate-300">-</span>
  if (km <= -TREND_MIN_KM) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-700">
        <ArrowDownRight className="h-3.5 w-3.5" /> mendekat
      </span>
    )
  }
  if (km >= TREND_MIN_KM) {
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-700">
        <ArrowUpRight className="h-3.5 w-3.5" /> menjauh
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-500">
      <Minus className="h-3.5 w-3.5" /> diam
    </span>
  )
}

function MapLink({ unit }: { unit: FleetUnit }) {
  if (unit.lat === null || unit.lng === null) return null
  return (
    <a
      href={`https://www.google.com/maps?q=${unit.lat},${unit.lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--mtu-navy)] hover:underline"
    >
      Peta <ExternalLink className="h-3 w-3" />
    </a>
  )
}

export default function FleetOverview() {
  const pathname = usePathname()
  const geofenceHref = pathname.replace(/\/fleet$/, '/geofences')

  const [data, setData] = useState<FleetResponse | null>(null)
  const [error, setError] = useState('')
  const [region, setRegion] = useState<RegionId | 'all'>('all')
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        if (document.hidden) return
        const response = await fetch('/api/fleet', { cache: 'no-store' })
        const json = await response.json()
        if (!alive) return
        if (!response.ok) {
          setError(json.error || 'Gagal memuat data armada.')
          return
        }
        setData(json as FleetResponse)
        setNow(Date.now())
        setError('')
      } catch {
        if (alive) setError('Gagal memuat data armada. Periksa koneksi.')
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const units = useMemo(() => data?.units || [], [data])

  const regions = useMemo(() => {
    const map = new Map<
      RegionId,
      { total: number; moving: number; still: number; offline: number; types: Map<string, number> }
    >()
    for (const id of REGION_ORDER) {
      map.set(id, { total: 0, moving: 0, still: 0, offline: 0, types: new Map() })
    }
    for (const unit of units) {
      if (!unit.region) continue
      const entry = map.get(unit.region)
      if (!entry) continue
      entry.total += 1
      if (unit.gps === 'offline') entry.offline += 1
      else if (unit.gps === 'moving') entry.moving += 1
      else entry.still += 1
      const type = unit.vehicleType || 'Jenis belum diketahui'
      entry.types.set(type, (entry.types.get(type) || 0) + 1)
    }
    return map
  }, [units])

  const noPosition = units.filter((unit) => !unit.region).length
  const inPool = units.filter((unit) => unit.inPool).length

  const outside = units
    .filter((unit) => unit.journey === 'out_of_town' && !unit.trip)
    .sort((a, b) => (a.eta || '').localeCompare(b.eta || ''))
  const outsideWithTrip = units.filter(
    (unit) => unit.journey === 'out_of_town' && unit.trip
  ).length
  const returning = units
    .filter((unit) => unit.journey === 'returning')
    .sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0))
  const reloaded = units.filter(
    (unit) =>
      unit.journey === 'reloaded' &&
      unit.reloadedAt &&
      now - new Date(unit.reloadedAt).getTime() < RELOADED_SHOW_MS
  )

  const keyword = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const tableUnits = units
    .filter((unit) => region === 'all' || unit.region === region)
    .filter(
      (unit) =>
        !keyword ||
        unit.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(keyword) ||
        (unit.vehicleType || '').toUpperCase().includes(search.trim().toUpperCase())
    )
    .sort((a, b) => a.plate.localeCompare(b.plate))

  const journeyStale =
    data?.journeyReady &&
    (!data.journeyUpdatedAt ||
      now - new Date(data.journeyUpdatedAt).getTime() > JOURNEY_STALE_MS)

  if (!data && !error) {
    return (
      <div className="panel p-10 text-center text-[13px] text-slate-500">
        Memuat posisi armada…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="panel flex items-center gap-2 border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {data && !data.pool && (
        <div className="panel flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <Warehouse className="h-4 w-4" />
          <span>
            Lokasi pool belum diset. Buat geofence jenis <b>Pool</b> supaya jarak &amp; perkiraan
            tiba bisa dihitung.
          </span>
          <Link href={geofenceHref} className="btn btn-secondary ml-auto">
            Atur Pool
          </Link>
        </div>
      )}

      {data && !data.journeyReady && (
        <div className="panel border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Tabel status perjalanan belum tersedia. Jalankan migration{' '}
          <code>20261117_fleet_journey.sql</code> di Supabase.
        </div>
      )}

      {journeyStale && (
        <div className="panel border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Status perjalanan terakhir diperbarui {formatAgo(data?.journeyUpdatedAt || null, now)}.
          Pastikan cron <code>/api/cron/check-alerts</code> berjalan tiap beberapa menit.
        </div>
      )}

      {/* Sebaran per wilayah */}
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Sebaran Unit</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {units.length} unit GPS · {inPool} di pool
              {noPosition ? ` · ${noPosition} tanpa posisi` : ''} · diperbarui{' '}
              {data ? formatAgo(data.fetchedAt, now) : '-'}
            </p>
          </div>
          {region !== 'all' && (
            <button type="button" onClick={() => setRegion('all')} className="btn btn-secondary">
              Tampilkan semua
            </button>
          )}
        </div>

        <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          {REGION_ORDER.filter(
            (id) => id === 'dalam_kota' || (regions.get(id)?.total || 0) > 0
          ).map((id) => {
            const entry = regions.get(id)!
            const types = Array.from(entry.types.entries()).sort((a, b) => b[1] - a[1])
            const active = region === id

            return (
              <button
                key={id}
                type="button"
                onClick={() => setRegion(active ? 'all' : id)}
                className={`bg-white p-4 text-left transition hover:bg-slate-50 ${
                  active ? 'outline outline-2 -outline-offset-2 outline-[var(--mtu-navy)]' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-700">
                    {REGION_LABEL[id]}
                  </span>
                  <span className="stat-value text-[22px] font-bold text-slate-900">
                    {entry.total}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-slate-500">
                  Jalan {entry.moving} · Diam {entry.still} · Offline {entry.offline}
                </p>
                <ul className="mt-2 space-y-0.5 text-[12px] text-slate-600">
                  {types.slice(0, 4).map(([type, count]) => (
                    <li key={type} className="flex justify-between gap-2">
                      <span className="truncate">{type}</span>
                      <span className="tabular-nums font-medium">{count}</span>
                    </li>
                  ))}
                  {types.length > 4 && (
                    <li className="text-slate-400">+{types.length - 4} jenis lain</li>
                  )}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      {/* Menuju pool */}
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="panel-title flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-slate-400" />
              Menuju {data?.pool?.name || 'Pool'}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Unit yang tercatat keluar kota sejak terakhir dari pool. Unit kota tidak masuk
              daftar ini. Perkiraan tiba kasar: memperhitungkan istirahat malam &amp;
              penyeberangan.
            </p>
          </div>
        </div>

        <HomeSection
          title="Masih di luar kota (tanpa trip aktif)"
          empty="Tidak ada unit luar kota yang sedang pulang."
          note={
            outsideWithTrip
              ? `${outsideWithTrip} unit luar kota lain masih punya trip aktif, tidak dihitung pulang.`
              : null
          }
          units={outside}
          render={(unit) => (
            <>
              <Cell className="w-[130px] font-semibold text-slate-900">{unit.plate}</Cell>
              <Cell className="w-[130px]">{unit.vehicleType || '-'}</Cell>
              <Cell className="w-[150px]">
                {unit.region ? REGION_LABEL[unit.region] : '-'}
              </Cell>
              <Cell className="w-[90px] text-right tabular-nums">
                {unit.distKm !== null ? `±${Math.round(unit.distKm * 1.3)} km` : '-'}
              </Cell>
              <Cell className="w-[100px]">
                <Trend km={unit.trendKm} />
              </Cell>
              <Cell className="w-[150px] font-medium">{formatEta(unit.eta, now)}</Cell>
              <Cell>
                <span className="text-slate-500">keluar kota {formatAgo(unit.wentOutAt, now)}</span>{' '}
                <MapLink unit={unit} />
              </Cell>
            </>
          )}
        />

        <HomeSection
          title="Sudah masuk dalam kota"
          empty="Belum ada unit luar kota yang masuk zona dalam kota."
          units={returning}
          render={(unit) => (
            <>
              <Cell className="w-[130px] font-semibold text-slate-900">{unit.plate}</Cell>
              <Cell className="w-[130px]">{unit.vehicleType || '-'}</Cell>
              <Cell className="w-[150px]">{GPS_LABEL[unit.gps]}</Cell>
              <Cell className="w-[90px] text-right tabular-nums">
                {unit.distKm !== null ? `±${Math.round(unit.distKm * 1.3)} km` : '-'}
              </Cell>
              <Cell className="w-[100px]">
                <Trend km={unit.trendKm} />
              </Cell>
              <Cell className="w-[150px] font-medium">{formatEta(unit.eta, now)}</Cell>
              <Cell>
                {unit.trip ? (
                  <span className="text-amber-700">Masih ada trip: {tripText(unit)}</span>
                ) : (
                  <span className="text-slate-500">masuk zona {formatAgo(unit.returnedAt, now)}</span>
                )}{' '}
                <MapLink unit={unit} />
              </Cell>
            </>
          )}
        />

        <HomeSection
          title="Batal pulang (muat lagi)"
          empty="Tidak ada."
          units={reloaded}
          tone="amber"
          render={(unit) => (
            <>
              <Cell className="w-[130px] font-semibold text-slate-900">{unit.plate}</Cell>
              <Cell className="w-[130px]">{unit.vehicleType || '-'}</Cell>
              <Cell className="w-[150px]">{GPS_LABEL[unit.gps]}</Cell>
              <Cell className="w-[90px]" />
              <Cell className="w-[100px]" />
              <Cell className="w-[150px]">{formatAgo(unit.reloadedAt, now)}</Cell>
              <Cell>
                {unit.reload
                  ? `Order baru: ${unit.reload.customer || '-'} · PK ${unit.reload.pkNumber || '-'}`
                  : 'Berhenti di area muat'}{' '}
                <MapLink unit={unit} />
              </Cell>
            </>
          )}
        />
      </div>

      {/* Daftar unit */}
      <div className="panel overflow-hidden">
        <div className="panel-header flex-wrap gap-3">
          <h2 className="panel-title">
            Daftar Unit{region !== 'all' ? ` — ${REGION_LABEL[region]}` : ''} ({tableUnits.length})
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari plat / jenis unit"
              className="w-full rounded-md border border-[var(--border)] py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-[var(--mtu-navy)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr>
                {['Plat', 'Jenis', 'Wilayah', 'GPS', 'Status Perjalanan', 'Trip', 'Jarak ke Pool', ''].map(
                  (head) => (
                    <th key={head} className="px-4 py-2 text-left">
                      {head}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {tableUnits.map((unit) => (
                <tr key={unit.imei}>
                  <td className="px-4 py-2 font-semibold text-slate-900">{unit.plate}</td>
                  <td className="px-4 py-2">{unit.vehicleType || <span className="text-slate-400">Belum diketahui</span>}</td>
                  <td className="px-4 py-2">{unit.region ? REGION_LABEL[unit.region] : '-'}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${GPS_DOT[unit.gps]}`} />
                      {GPS_LABEL[unit.gps]}
                      {unit.gps === 'moving' ? ` ${Math.round(unit.speed)} km/j` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {unit.inPool ? 'Di Pool' : unit.journey ? JOURNEY_LABEL[unit.journey] : '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{tripText(unit) || '-'}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {unit.inPool ? '-' : unit.distKm !== null ? `${unit.distKm} km` : '-'}
                  </td>
                  <td className="px-4 py-2">
                    <MapLink unit={unit} />
                  </td>
                </tr>
              ))}
              {tableUnits.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada unit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] px-4 py-2 text-[11.5px] text-slate-400">
          Jenis unit diambil dari order terakhir unit tersebut. Jarak di daftar ini garis lurus;
          di bagian Menuju Pool sudah dikali faktor jalan.
        </p>
      </div>
    </div>
  )
}

function Cell({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <td className={`px-4 py-2 align-top ${className}`}>{children}</td>
}

function HomeSection({
  title,
  empty,
  note,
  units,
  render,
  tone,
}: {
  title: string
  empty: string
  note?: string | null
  units: FleetUnit[]
  render: (unit: FleetUnit) => ReactNode
  tone?: 'amber'
}) {
  return (
    <div className="border-t border-[var(--border)] first:border-t-0">
      <div
        className={`flex items-center justify-between px-4 py-2 text-[12px] font-semibold ${
          tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'
        }`}
      >
        <span>
          {title} ({units.length})
        </span>
        {note && <span className="font-normal text-slate-500">{note}</span>}
      </div>
      {units.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-slate-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed text-[13px]">
            <tbody>
              {units.map((unit) => (
                <tr key={unit.imei}>{render(unit)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
