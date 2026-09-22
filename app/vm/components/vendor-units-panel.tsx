'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { Search, Truck, CheckCircle2, Clock, X, Save, Loader2 } from 'lucide-react'

type VendorUnitRow = {
  id: string
  orderId: string
  vehicleType: string
  noBuntut: string | null
  plateNumber: string | null
  driverName: string | null
  driverPhone: string | null
  vendorName: string | null
  status: string | null
  isFilled: boolean
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  trip: string | null
  orderStatus: string | null
  createdAt: string
}

type VendorUnitsPanelProps = {
  rows: VendorUnitRow[]
  totalCount: number
  pendingCount: number
  filledCount: number
}

type StatusFilter = 'all' | 'pending' | 'filled'

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Belum Diisi' },
  { value: 'filled', label: 'Sudah Diisi' },
]

export default function VendorUnitsPanel({
  rows,
  totalCount,
  pendingCount,
  filledCount,
}: VendorUnitsPanelProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingRow, setEditingRow] = useState<VendorUnitRow | null>(null)

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (statusFilter === 'pending' && row.isFilled) return false
      if (statusFilter === 'filled' && !row.isFilled) return false

      if (keyword) {
        const haystack = [
          row.customer,
          row.pkNumber || '',
          row.rftTrJob || '',
          row.vendorName || '',
          row.driverName || '',
          row.plateNumber || '',
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [rows, search, statusFilter])

  const kpiItems = [
    {
      label: 'Total Unit Vendor',
      value: totalCount,
      color: 'text-gray-900',
      icon: Truck,
    },
    {
      label: 'Belum Diisi Detail',
      value: pendingCount,
      color: 'text-amber-600',
      icon: Clock,
    },
    {
      label: 'Sudah Diisi',
      value: filledCount,
      color: 'text-emerald-600',
      icon: CheckCircle2,
    },
  ]

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpiItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">
                  {item.label}
                </p>
                <Icon className="h-4 w-4 text-gray-300" />
              </div>
              <p className={`mt-1.5 text-2xl font-extrabold ${item.color}`}>
                {item.value}
              </p>
            </div>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari customer, PK, vendor, driver..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="flex items-center gap-1 rounded-full bg-gray-50 p-1 ring-1 ring-inset ring-gray-200">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-gray-200 px-6 py-2 text-xs text-gray-400">
          Menampilkan {filteredRows.length} dari {rows.length} unit vendor
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="w-[200px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="w-[140px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  PK / RFT
                </th>
                <th className="w-[170px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  PT Vendor
                </th>
                <th className="w-[120px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  No Unit
                </th>
                <th className="w-[150px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Driver
                </th>
                <th className="w-[110px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Jenis
                </th>
                <th className="w-[120px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="w-[110px] px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Truck className="h-6 w-6" />
                      <span className="text-sm">
                        Tidak ada unit vendor yang cocok dengan pencarian/filter ini.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <p className="truncate text-[13px] font-bold text-gray-900" title={row.customer}>
                        {row.customer}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[13px] font-semibold text-gray-900">
                        {row.pkNumber || '-'}
                      </div>
                      {row.rftTrJob && (
                        <div className="text-[11.5px] text-gray-400">{row.rftTrJob}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-700">
                      {row.vendorName || <span className="text-gray-300">Belum diisi</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-700">
                      {row.plateNumber || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-700">
                      {row.driverName || <span className="text-gray-300">-</span>}
                      {row.driverPhone && (
                        <div className="text-[11.5px] text-gray-400">{row.driverPhone}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-700">
                      {row.vehicleType}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.isFilled ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          Sudah Diisi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          Belum Diisi
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingRow(row)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                          row.isFilled
                            ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {row.isFilled ? 'Edit' : 'Isi Detail'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow && (
        <VendorUnitFormModal row={editingRow} onClose={() => setEditingRow(null)} />
      )}
    </>
  )
}

function VendorUnitFormModal({
  row,
  onClose,
}: {
  row: VendorUnitRow
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [vendorName, setVendorName] = useState(row.vendorName || '')
  const [plateNumber, setPlateNumber] = useState(row.plateNumber || '')
  const [noBuntut, setNoBuntut] = useState(row.noBuntut || '')
  const [driverName, setDriverName] = useState(row.driverName || '')
  const [driverPhone, setDriverPhone] = useState(row.driverPhone || '')
  const [saving, setSaving] = useState(false)

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
  const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    if (!vendorName.trim() || !plateNumber.trim() || !driverName.trim() || !driverPhone.trim()) {
      toast.error('Data Belum Lengkap', 'PT Vendor, No Unit, Nama Driver, dan No Telepon wajib diisi.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.rpc('vm_fill_vendor_unit', {
        p_truck_id: row.id,
        p_vendor_name: vendorName.trim(),
        p_plate_number: plateNumber.trim(),
        p_driver_name: driverName.trim(),
        p_driver_phone: driverPhone.trim(),
        p_no_buntut: noBuntut.trim() || null,
      })

      if (error) {
        console.error('VM FILL VENDOR UNIT ERROR:', error)
        toast.error('Gagal Menyimpan', error.message)
        return
      }

      toast.success('Tersimpan', 'Detail unit vendor berhasil disimpan.')
      onClose()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Isi Detail Unit Vendor
            </h3>
            <p className="text-xs text-gray-400">
              {row.customer} · {row.pkNumber || row.rftTrJob || '-'} · {row.vehicleType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 px-6 py-5">
          <div>
            <label className={labelClass}>Nama PT Vendor</label>
            <input
              type="text"
              value={vendorName}
              onChange={(event) => setVendorName(event.target.value)}
              placeholder="PT ABC Transport"
              required
              disabled={saving}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>No Unit (Plat)</label>
              <input
                type="text"
                value={plateNumber}
                onChange={(event) => setPlateNumber(event.target.value)}
                placeholder="B 1234 XYZ"
                required
                disabled={saving}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>No Buntut (opsional)</label>
              <input
                type="text"
                value={noBuntut}
                onChange={(event) => setNoBuntut(event.target.value)}
                disabled={saving}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Nama Driver</label>
            <input
              type="text"
              value={driverName}
              onChange={(event) => setDriverName(event.target.value)}
              placeholder="Budi"
              required
              disabled={saving}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>No Telepon Driver</label>
            <input
              type="text"
              value={driverPhone}
              onChange={(event) => setDriverPhone(event.target.value)}
              placeholder="0812xxxxxxx"
              required
              disabled={saving}
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Simpan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
