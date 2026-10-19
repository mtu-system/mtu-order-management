'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { normalizePlate } from '@/lib/plate'
import { upperValue } from '@/lib/upper-value'

type Link = { id: string; plate_key: string; plate_label: string; imei: string }
type Device = {
  imei: string
  deviceName: string
  online: boolean
  gpsTime: string | null
}

const STALE_MS = 24 * 60 * 60 * 1000

function isFresh(device: Device) {
  if (!device.gpsTime) return false
  const time = new Date(device.gpsTime.replace(' ', 'T') + 'Z').getTime()
  return Date.now() - time < STALE_MS
}

export default function GpsLinkManager({
  initialLinks,
  activePlates,
}: {
  initialLinks: Link[]
  activePlates: string[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [links, setLinks] = useState(initialLinks)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [plate, setPlate] = useState('')
  const [deviceSearch, setDeviceSearch] = useState('')
  const [selectedImei, setSelectedImei] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true

    fetch('/api/tracksolid/devices', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        if (!alive) return
        if (json.devices) setDevices(json.devices)
        else setLoadError(true)
      })
      .catch(() => alive && setLoadError(true))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [])

  const deviceByImei = useMemo(
    () => new Map(devices.map((device) => [device.imei, device])),
    [devices]
  )

  // Plat order aktif yang belum punya link manual dan belum cocok otomatis.
  const unlinkedPlates = useMemo(() => {
    const linkedKeys = new Set(links.map((link) => link.plate_key))
    const names = devices.map((device) => normalizePlate(device.deviceName))

    return activePlates.filter((label) => {
      const key = normalizePlate(label)
      if (!key || linkedKeys.has(key)) return false
      if (key.length >= 4 && names.some((name) => name.includes(key))) return false
      return true
    })
  }, [activePlates, links, devices])

  const filteredDevices = useMemo(() => {
    const keyword = deviceSearch.trim().toLowerCase()
    const list = keyword
      ? devices.filter(
          (device) =>
            device.deviceName.toLowerCase().includes(keyword) ||
            device.imei.includes(keyword)
        )
      : devices

    return list.slice(0, 80)
  }, [devices, deviceSearch])

  async function handleSave() {
    const key = normalizePlate(plate)

    if (!key) {
      toast.error('Plat Kosong', 'Isi plat nomor unit terlebih dahulu.')
      return
    }

    if (!selectedImei) {
      toast.error('Perangkat Belum Dipilih', 'Pilih perangkat GPS dari daftar.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('gps_device_links')
        .upsert(
          {
            plate_key: key,
            plate_label: plate.trim(),
            imei: selectedImei,
            created_by: user?.id || null,
          },
          { onConflict: 'plate_key' }
        )
        .select('id, plate_key, plate_label, imei')
        .single()

      if (error || !data) {
        console.error('GPS LINK SAVE ERROR:', error)
        toast.error('Gagal Menyimpan', error?.message || 'Coba lagi.')
        return
      }

      setLinks((current) => [
        data as Link,
        ...current.filter((link) => link.plate_key !== key),
      ])
      setPlate('')
      setSelectedImei('')
      setDeviceSearch('')
      toast.success('Tersimpan', `${data.plate_label} terhubung ke GPS.`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(link: Link) {
    const ok = await confirm({
      title: 'Hapus Hubungan GPS?',
      message: `Plat ${link.plate_label} tidak lagi terhubung ke perangkat GPS.`,
      confirmLabel: 'Ya, Hapus',
      danger: true,
    })

    if (!ok) return

    const { error } = await supabase
      .from('gps_device_links')
      .delete()
      .eq('id', link.id)

    if (error) {
      toast.error('Gagal Menghapus', error.message)
      return
    }

    setLinks((current) => current.filter((item) => item.id !== link.id))
    toast.success('Dihapus', 'Hubungan GPS dihapus.')
  }

  return (
    <div className="space-y-5">
      {unlinkedPlates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-900">
            {unlinkedPlates.length} plat di order aktif belum terhubung GPS
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Klik plat untuk mengisinya ke form di bawah.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {unlinkedPlates.slice(0, 40).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setPlate(label.toUpperCase())}
                className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-extrabold text-gray-900">
          Hubungkan Plat ke Perangkat GPS
        </h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">
              Plat Nomor Unit
            </label>
            <input
              type="text"
              value={plate}
              onChange={(event) => setPlate(upperValue(event))}
              placeholder="B 1234 XYZ"
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">
              Cari Perangkat (nama / IMEI)
            </label>
            <input
              type="text"
              value={deviceSearch}
              onChange={(event) => setDeviceSearch(event.target.value)}
              placeholder={loading ? 'Memuat perangkat...' : 'Ketik untuk mencari'}
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </div>
        </div>

        {loadError && (
          <p className="mt-3 text-xs font-semibold text-red-600">
            Daftar perangkat GPS gagal dimuat. Muat ulang halaman.
          </p>
        )}

        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-200">
          {filteredDevices.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-400">
              {loading ? 'Memuat...' : 'Perangkat tidak ditemukan.'}
            </p>
          ) : (
            filteredDevices.map((device) => (
              <button
                key={device.imei}
                type="button"
                onClick={() => setSelectedImei(device.imei)}
                className={`flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 text-left text-sm last:border-0 hover:bg-gray-50 ${
                  selectedImei === device.imei
                    ? 'bg-blue-100 ring-2 ring-inset ring-[#2563EB]'
                    : ''
                }`}
              >
                <span className="font-semibold text-gray-800">
                  {device.deviceName}
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    isFresh(device) ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                >
                  {isFresh(device) ? 'Aktif' : 'Lama tidak update'}
                </span>
              </button>
            ))
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Perangkat dipilih:{' '}
          <span className="font-bold text-gray-900">
            {selectedImei
              ? deviceByImei.get(selectedImei)?.deviceName || selectedImei
              : 'belum ada'}
          </span>
        </p>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#2563EB]/85 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Simpan Hubungan
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3 text-sm font-extrabold text-gray-900">
          Hubungan Manual ({links.length})
        </div>

        {links.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            Belum ada hubungan manual. Plat yang namanya sama dengan perangkat
            GPS tetap terhubung otomatis.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {links.map((link) => {
              const device = deviceByImei.get(link.imei)

              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {link.plate_label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {device ? device.deviceName : 'Perangkat tidak ditemukan'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(link)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}