'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { Link2, Loader2, Search, Trash2, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { type Geofence, FENCE_COLOR, FENCE_LABEL, parseCoordinates } from '@/lib/geo'
import { normalizePlate } from '@/lib/plate'
import type { FleetResponse } from '@/lib/fleet'

export type GeofencePrefill = {
  lat: number
  lng: number
  name?: string
  type?: Geofence['type']
}

type SearchResult = { lat: number; lng: number; label: string }

export default function GeofenceManager({
  initialFences,
  prefill,
}: {
  initialFences: Geofence[]
  prefill?: GeofencePrefill | null
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const fenceLayerRef = useRef<LayerGroup | null>(null)
  const draftLayerRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)

  const [ready, setReady] = useState(false)
  const [fences, setFences] = useState(initialFences)
  const [name, setName] = useState(prefill?.name || '')
  const [type, setType] = useState<Geofence['type']>(prefill?.type || 'loading')
  const [radius, setRadius] = useState(300)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    prefill ? { lat: prefill.lat, lng: prefill.lng } : null
  )
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [linkText, setLinkText] = useState('')
  const [resolving, setResolving] = useState(false)
  const [unitPlate, setUnitPlate] = useState('')
  const [unitLoading, setUnitLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      leafletRef.current = L
      const map = prefill
        ? L.map(containerRef.current).setView([prefill.lat, prefill.lng], 16)
        : L.map(containerRef.current).setView([-6.3, 107.0], 9)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      fenceLayerRef.current = L.layerGroup().addTo(map)
      draftLayerRef.current = L.layerGroup().addTo(map)

      map.on('click', (event) => {
        setCenter({ lat: event.latlng.lat, lng: event.latlng.lng })
      })

      mapRef.current = map
      setReady(true)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Geofence yang sudah tersimpan.
  useEffect(() => {
    const L = leafletRef.current
    const layer = fenceLayerRef.current
    if (!ready || !L || !layer) return

    layer.clearLayers()

    for (const fence of fences) {
      L.circle([fence.lat, fence.lng], {
        radius: fence.radius_m,
        color: FENCE_COLOR[fence.type],
        weight: 2,
        fillOpacity: 0.15,
      })
        .bindTooltip(`${fence.name} (${FENCE_LABEL[fence.type]})`)
        .addTo(layer)
    }
  }, [ready, fences])

  // Lingkaran calon geofence (belum disimpan).
  useEffect(() => {
    const L = leafletRef.current
    const layer = draftLayerRef.current
    if (!ready || !L || !layer) return

    layer.clearLayers()
    if (!center) return

    L.circle([center.lat, center.lng], {
      radius: radius,
      color: FENCE_COLOR[type],
      weight: 2,
      dashArray: '6 6',
      fillOpacity: 0.25,
    }).addTo(layer)
  }, [ready, center, radius, type])

  async function handleSearch() {
    const keyword = search.trim()
    if (!keyword || !mapRef.current) return

    setSearching(true)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=id&q=${encodeURIComponent(keyword)}`
      )
      const found = await response.json()

      if (!Array.isArray(found) || found.length === 0) {
        setResults([])
        toast.error(
          'Tidak Ditemukan',
          'Coba kata kunci lebih umum, tempel link Google Maps, atau ambil dari posisi unit.'
        )
        return
      }

      const list: SearchResult[] = found.map((item: { lat: string; lon: string; display_name: string }) => ({
        lat: Number(item.lat),
        lng: Number(item.lon),
        label: item.display_name,
      }))
      setResults(list)
      mapRef.current.flyTo([list[0].lat, list[0].lng], 15)
    } catch {
      toast.error('Pencarian Gagal', 'Klik peta langsung untuk menandai lokasi.')
    } finally {
      setSearching(false)
    }
  }

  function applyCenter(point: { lat: number; lng: number }, zoom = 16) {
    setCenter(point)
    mapRef.current?.flyTo([point.lat, point.lng], zoom)
  }

  // Tempel link Google Maps (termasuk link pendek maps.app.goo.gl) atau koordinat.
  async function handleLink() {
    const text = linkText.trim()
    if (!text) return

    const direct = parseCoordinates(text)
    if (direct) {
      applyCenter(direct)
      toast.success('Lokasi Ditemukan', 'Periksa lingkaran di peta, lalu simpan.')
      return
    }

    if (!/^https:\/\//i.test(text)) {
      toast.error('Format Tidak Dikenal', 'Tempel link Google Maps atau koordinat, mis. -6.2245, 106.9921')
      return
    }

    setResolving(true)
    try {
      const response = await fetch(`/api/geo/resolve-link?url=${encodeURIComponent(text)}`, {
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) {
        toast.error('Gagal Membaca Link', json.error || 'Coba salin koordinatnya langsung.')
        return
      }
      applyCenter(json as { lat: number; lng: number })
      toast.success('Lokasi Ditemukan', 'Periksa lingkaran di peta, lalu simpan.')
    } catch {
      toast.error('Gagal Membaca Link', 'Periksa koneksi lalu coba lagi.')
    } finally {
      setResolving(false)
    }
  }

  // Ambil titik dari posisi GPS unit saat ini (mis. unit yang sedang parkir di pool).
  async function handleUnitPosition() {
    const key = normalizePlate(unitPlate)
    if (key.length < 3) {
      toast.error('Plat Kosong', 'Ketik plat unit yang sedang berada di lokasi.')
      return
    }

    setUnitLoading(true)
    try {
      const response = await fetch('/api/fleet', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) {
        toast.error('Gagal Memuat Posisi', json.error || 'Coba lagi.')
        return
      }
      const unit = (json as FleetResponse).units.find(
        (item) => normalizePlate(item.plate) === key || normalizePlate(item.plate).includes(key)
      )
      if (!unit || unit.lat === null || unit.lng === null) {
        toast.error('Unit Tidak Ditemukan', 'Plat tidak cocok dengan perangkat GPS mana pun.')
        return
      }
      if (unit.gps === 'offline') {
        toast.error('GPS Offline', `Posisi ${unit.plate} bukan posisi terkini. Periksa sebelum menyimpan.`)
      }
      applyCenter({ lat: unit.lat, lng: unit.lng }, 17)
    } catch {
      toast.error('Gagal Memuat Posisi', 'Periksa koneksi lalu coba lagi.')
    } finally {
      setUnitLoading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Nama Kosong', 'Isi nama lokasi terlebih dahulu.')
      return
    }

    if (!center) {
      toast.error('Lokasi Belum Dipilih', 'Klik peta untuk menandai titik pusat.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('geofences')
        .insert({
          name: name.trim(),
          type,
          lat: center.lat,
          lng: center.lng,
          radius_m: radius,
          created_by: user?.id || null,
        })
        .select('id, name, type, lat, lng, radius_m')
        .single()

      if (error || !data) {
        console.error('GEOFENCE SAVE ERROR:', error)
        toast.error('Gagal Menyimpan', error?.message || 'Coba lagi.')
        return
      }

      setFences((current) => [data as Geofence, ...current])
      setName('')
      setCenter(null)
      toast.success('Tersimpan', `${data.name} ditambahkan.`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(fence: Geofence) {
    const ok = await confirm({
      title: 'Hapus Geofence?',
      message: `Lokasi "${fence.name}" akan dihapus.`,
      confirmLabel: 'Ya, Hapus',
      danger: true,
    })

    if (!ok) return

    const { error } = await supabase.from('geofences').delete().eq('id', fence.id)

    if (error) {
      toast.error('Gagal Menghapus', error.message)
      return
    }

    setFences((current) => current.filter((item) => item.id !== fence.id))
    toast.success('Dihapus', 'Geofence dihapus.')
  }

  const input =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10'

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-extrabold text-gray-900">Tambah Geofence</h2>
        <p className="mt-1 text-xs text-gray-500">
          Tentukan titik dengan salah satu cara: tempel link/koordinat dari Google Maps atau
          WhatsApp, ambil dari posisi unit yang sedang di lokasi, cari nama tempat, atau klik
          peta. Paling mudah: buka Laporan Unit, lalu klik <b>Jadikan Geofence</b> di titik
          berhenti unit.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">
              Tempel Link Google Maps / Koordinat
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleLink()}
                placeholder="https://maps.app.goo.gl/… atau -6.2245, 106.9921"
                className={input}
              />
              <button
                type="button"
                onClick={handleLink}
                disabled={resolving}
                className="btn btn-secondary shrink-0"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Pakai
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">
              Ambil dari Posisi Unit Sekarang
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={unitPlate}
                onChange={(event) => setUnitPlate(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === 'Enter' && handleUnitPosition()}
                placeholder="Plat unit yang sedang di lokasi, mis. B 9940 KEH"
                className={input}
              />
              <button
                type="button"
                onClick={handleUnitPosition}
                disabled={unitLoading}
                className="btn btn-secondary shrink-0"
              >
                {unitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Ambil
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-gray-600">
              Cari Lokasi di Peta
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                placeholder="Contoh: Pelabuhan Tanjung Priok"
                className={input}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg bg-gray-100 px-3 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                aria-label="Cari"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
            {results.length > 1 && (
              <ul className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-gray-200 text-xs">
                {results.map((result, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => mapRef.current?.flyTo([result.lat, result.lng], 16)}
                      className="block w-full truncate px-3 py-1.5 text-left hover:bg-gray-50"
                      title={result.label}
                    >
                      {result.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Nama Lokasi</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Gudang BSD"
              className={`mt-1.5 ${input}`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Jenis</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as Geofence['type'])}
              className={`mt-1.5 ${input}`}
            >
              <option value="loading">Area Loading</option>
              <option value="unloading">Area Bongkar</option>
              <option value="pool">Pool</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">
              Radius: {radius} m
            </label>
            <input
              type="range"
              min={50}
              max={3000}
              step={50}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </div>

          <p className="text-xs text-gray-500">
            {center
              ? `Titik: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
              : 'Klik peta untuk menandai titik pusat.'}
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#2563EB]/85 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Geofence
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div ref={containerRef} className="isolate z-0 h-[420px] w-full" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-900">
          Geofence Tersimpan ({fences.length})
        </div>

        {fences.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            Belum ada geofence.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {fences.map((fence) => (
              <div
                key={fence.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <button
                  type="button"
                  onClick={() => mapRef.current?.flyTo([fence.lat, fence.lng], 15)}
                  className="text-left"
                >
                  <p className="text-sm font-bold text-gray-900">{fence.name}</p>
                  <p className="text-xs text-gray-500">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ background: FENCE_COLOR[fence.type] }}
                    />
                    {FENCE_LABEL[fence.type]} · radius {fence.radius_m} m
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(fence)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}