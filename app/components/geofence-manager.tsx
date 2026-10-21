'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { type Geofence, FENCE_COLOR, FENCE_LABEL } from '@/lib/geo'

export default function GeofenceManager({
  initialFences,
}: {
  initialFences: Geofence[]
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
  const [name, setName] = useState('')
  const [type, setType] = useState<Geofence['type']>('loading')
  const [radius, setRadius] = useState(300)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      leafletRef.current = L
      const map = L.map(containerRef.current).setView([-6.3, 107.0], 9)

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
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(keyword)}`
      )
      const results = await response.json()

      if (!Array.isArray(results) || results.length === 0) {
        toast.error('Tidak Ditemukan', 'Coba kata kunci lain atau klik peta langsung.')
        return
      }

      mapRef.current.flyTo(
        [Number(results[0].lat), Number(results[0].lon)],
        15
      )
    } catch {
      toast.error('Pencarian Gagal', 'Klik peta langsung untuk menandai lokasi.')
    } finally {
      setSearching(false)
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