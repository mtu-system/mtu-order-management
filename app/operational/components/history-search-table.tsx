'use client'

import { useMemo, useState } from 'react'
import { Inbox, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import OrderUnitsModal from '@/app/operational/components/order-units-modal'

type UnitRow = {
  id: string
  vehicle_type: string
  source: string | null
  status: string | null
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
}

type HistoryRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  quantity: number
  trip: string | null
  status: string
  reasonLabel: string
  dateLabel: string
  sortDateIso: string
  internalCount: number
  vmCount: number
  avatarClass: string
  units: UnitRow[]
}

type HistorySearchTableProps = {
  orders: HistoryRow[]
}

type DatePreset = 'all' | '7d' | '30d' | 'month' | 'custom'

const statusOptions = [
  { value: 'all', label: 'Semua Status' },
  { value: 'ready_to_depart', label: 'Ready to Depart' },
  { value: 'ready_loading', label: 'Full VM' },
  { value: 'pending', label: 'Unit Tidak Tersedia' },
  { value: 'cancelled', label: 'Cancelled' },
]

function getStatusBadge(status: string) {
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
        Cancelled
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
        Unit Tidak Tersedia
      </span>
    )
  }
  if (status === 'ready_to_depart') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
        Ready to Depart
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
      Full VM
    </span>
  )
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function HistorySearchTable({ orders }: HistorySearchTableProps) {
  const [search, setSearch] = useState('')
  const [showPk, setShowPk] = useState(false)
  const [showRft, setShowRft] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState<DatePreset>('all')

  function applyPreset(preset: DatePreset) {
    setActivePreset(preset)
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    if (preset === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }
    if (preset === '7d') {
      const from = new Date()
      from.setDate(from.getDate() - 6)
      from.setHours(0, 0, 0, 0)
      setDateFrom(toDateInputValue(from))
      setDateTo(toDateInputValue(today))
      return
    }
    if (preset === '30d') {
      const from = new Date()
      from.setDate(from.getDate() - 29)
      from.setHours(0, 0, 0, 0)
      setDateFrom(toDateInputValue(from))
      setDateTo(toDateInputValue(today))
      return
    }
    if (preset === 'month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      setDateFrom(toDateInputValue(from))
      setDateTo(toDateInputValue(today))
      return
    }
  }

  const pkCount = useMemo(
    () => orders.filter((order) => order.pkNumber && order.pkNumber.trim()).length,
    [orders]
  )
  const rftCount = useMemo(
    () => orders.filter((order) => order.rftTrJob && order.rftTrJob.trim()).length,
    [orders]
  )

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return orders.filter((order) => {
      const hasPk = !!(order.pkNumber && order.pkNumber.trim())
      const hasRft = !!(order.rftTrJob && order.rftTrJob.trim())

      if (showPk && showRft) {
        if (!hasPk && !hasRft) return false
      } else if (showPk && !hasPk) {
        return false
      } else if (showRft && !hasRft) {
        return false
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'ready_loading') {
          if (order.status !== 'ready_loading') return false
        } else if (order.status !== statusFilter) {
          return false
        }
      }

      if (dateFrom) {
        const orderDate = new Date(order.sortDateIso)
        if (orderDate < new Date(`${dateFrom}T00:00:00`)) return false
      }
      if (dateTo) {
        const orderDate = new Date(order.sortDateIso)
        if (orderDate > new Date(`${dateTo}T23:59:59`)) return false
      }

      if (keyword) {
        const haystack = [
          order.customer,
          order.pkNumber || '',
          order.rftTrJob || '',
          order.trip || '',
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [orders, search, showPk, showRft, statusFilter, dateFrom, dateTo])

  function handleExport() {
    const rows = filteredOrders.map((order) => ({
      Customer: order.customer,
      'Nomor PK': order.pkNumber || '-',
      'RFT / TR / Job': order.rftTrJob || '-',
      Quantity: order.quantity,
      'Unit Internal': order.internalCount,
      'Unit VM': order.vmCount,
      Trip: order.trip || '-',
      Keterangan: order.reasonLabel,
      Tanggal: order.dateLabel,
    }))
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operational History')
    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `operational-history-${today}.xlsx`)
  }

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'month', label: 'Bulan Ini' },
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
            placeholder="Cari customer, PK, RFT, trip..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPk((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition ${
              showPk ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            PK
            <span className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${showPk ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {pkCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowRft((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition ${
              showRft ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            RFT
            <span className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${showRft ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {rftCount}
            </span>
          </button>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExport}
            disabled={!filteredOrders.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#2563EB]/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50/60 px-6 py-3">
        <span className="text-xs font-semibold text-gray-400">Tanggal:</span>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                activePreset === preset.key ? 'bg-[#2563EB] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setActivePreset('custom')
            }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
          <span className="text-xs text-gray-400">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setActivePreset('custom')
            }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
        </div>
      </div>

      <div className="border-b border-gray-200 px-6 py-2 text-xs text-gray-400">
        Menampilkan {filteredOrders.length} dari {orders.length} order
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Customer</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">PK</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">RFT / TR / Job</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Quantity</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Kendaraan</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Trip</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Keterangan</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Tanggal</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {!filteredOrders.length ? (
              <tr>
                <td colSpan={10} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Inbox className="h-6 w-6" />
                    <span className="text-sm">Tidak ada order yang cocok dengan pencarian/filter ini.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-gray-50/60">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${order.avatarClass}`}>
                        {order.customer.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-gray-900">{order.customer}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-4 font-semibold ${order.pkNumber ? 'text-gray-900' : 'text-gray-300'}`}>
                    {order.pkNumber || '-'}
                  </td>
                  <td className={`px-5 py-4 ${order.rftTrJob ? 'text-gray-700' : 'text-gray-300'}`}>
                    {order.rftTrJob || '-'}
                  </td>
                  <td className="px-5 py-4 font-bold text-gray-900">{order.quantity} Unit</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.internalCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
                          Internal {order.internalCount}
                        </span>
                      )}
                      {order.vmCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                          VM {order.vmCount}
                        </span>
                      )}
                      {order.internalCount === 0 && order.vmCount === 0 && (
                        <span className="text-gray-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{order.trip || '-'}</td>
                  <td className="px-5 py-4">{getStatusBadge(order.status)}</td>
                  <td className="max-w-xs px-5 py-4 text-gray-600">{order.reasonLabel}</td>
                  <td className="px-5 py-4 text-gray-500">{order.dateLabel}</td>
                  <td className="px-5 py-4 text-right">
                    <OrderUnitsModal
                      orderId={order.id}
                      customer={order.customer}
                      pkNumber={order.pkNumber}
                      units={order.units}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}