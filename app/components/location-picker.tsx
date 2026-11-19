'use client'

import { useState } from 'react'
import { Loader2, MapPin, Plus } from 'lucide-react'
import { parseCoordinates, type Geofence } from '@/lib/geo'
import { useToast } from '@/app/components/toast-provider'
import { createOrderLocation, type LocationType } from './order-location-actions'

const inputClass =
  'h-9 w-full rounded-md border border-[var(--border-strong)] bg-white px-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10 disabled:bg-slate-50'

// Pilih geofence lokasi muat / bongkar, atau buat baru dari link Google Maps.
export default function LocationPicker({
  id,
  label,
  type,
  fences,
  value,
  onChange,
  onCreated,
  disabled,
  hint,
}: {
  id: string
  label: string
  type: LocationType
  fences: Geofence[]
  value: string
  onChange: (id: string) => void
  onCreated: (fence: Geofence) => void
  disabled?: boolean
  hint?: string
}) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [radius, setRadius] = useState(500)
  const [busy, setBusy] = useState(false)
  const [overlap, setOverlap] = useState<{ message: string; existing: Geofence } | null>(null)

  const sameType = fences.filter((fence) => fence.type === type).sort((a, b) => a.name.localeCompare(b.name))
  const others = fences
    .filter((fence) => fence.type !== type && fence.type !== 'pool')
    .sort((a, b) => a.name.localeCompare(b.name))

  async function resolvePoint() {
    const text = link.trim()
    const direct = parseCoordinates(text)
    if (direct) return direct
    if (!/^https:\/\//i.test(text)) {
      toast.error('Format Tidak Dikenal', 'Tempel link Google Maps atau koordinat, mis. -6.2245, 106.9921')
      return null
    }
    const response = await fetch(`/api/geo/resolve-link?url=${encodeURIComponent(text)}`, { cache: 'no-store' })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error('Gagal Membaca Link', json.error || 'Coba salin koordinatnya langsung.')
      return null
    }
    return json as { lat: number; lng: number }
  }

  async function save(force = false) {
    if (name.trim().length < 2) {
      toast.error('Nama Lokasi Kosong', 'Isi nama lokasi, mis. "Geodipa Patuha".')
      return
    }
    setBusy(true)
    try {
      const point = await resolvePoint()
      if (!point) return
      const result = await createOrderLocation({ name, type, lat: point.lat, lng: point.lng, radius, force })
      if (!result.ok) {
        if (result.existing) setOverlap({ message: result.message, existing: result.existing })
        else toast.error('Gagal Menyimpan Lokasi', result.message)
        return
      }
      onCreated(result.fence)
      onChange(String(result.fence.id))
      toast.success('Lokasi Ditambahkan', result.fence.name)
      reset()
    } catch {
      toast.error('Gagal Menyimpan Lokasi', 'Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setAdding(false)
    setName('')
    setLink('')
    setRadius(500)
    setOverlap(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-[12px] font-semibold text-slate-700">
          {label}
        </label>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#082868] hover:underline disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Lokasi baru
          </button>
        )}
      </div>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">— Belum dipilih —</option>
        {sameType.map((fence) => (
          <option key={fence.id} value={fence.id}>
            {fence.name}
          </option>
        ))}
        {others.length > 0 && (
          <optgroup label="Lokasi lain">
            {others.map((fence) => (
              <option key={fence.id} value={fence.id}>
                {fence.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {hint && !adding && <p className="mt-1 text-[11.5px] text-slate-500">{hint}</p>}

      {adding && (
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama lokasi, mis. Geodipa Patuha"
            className={inputClass}
            disabled={busy}
          />
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Link Google Maps atau koordinat -6.2245, 106.9921"
            className={inputClass}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-slate-600">
              Radius
              <select
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
                className="h-8 rounded-md border border-[var(--border-strong)] bg-white px-2 text-[12.5px]"
                disabled={busy}
              >
                {[300, 500, 800, 1000, 1500].map((value) => (
                  <option key={value} value={value}>
                    {value} m
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex gap-1.5">
              <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={reset} disabled={busy}>
                Batal
              </button>
              <button type="button" className="btn btn-primary h-8 px-2.5" onClick={() => save(false)} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                Simpan Lokasi
              </button>
            </div>
          </div>

          {overlap && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              <p>{overlap.message} Pakai lokasi itu saja?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn btn-primary h-8 px-2.5"
                  onClick={() => {
                    onChange(String(overlap.existing.id))
                    reset()
                  }}
                >
                  Pakai {overlap.existing.name}
                </button>
                <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={() => save(true)} disabled={busy}>
                  Tetap buat baru
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
