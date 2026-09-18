'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Inbox, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

type ReportRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  orderType: string | null
  quantity: number
  decision: 'partial' | 'unavailable'
  decisionNote: string | null
  decidedByName: string
  decidedAt: string | null
  requirements: { vehicle_type: string; quantity: number }[]
}

type RejectReportTableProps = {
  rows: ReportRow[]
}

type DatePreset = 'all' | '7d' | '30d' | 'month' | 'custom'

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const decisionBadge: Record<string, string> = {
  partial: 'bg-amber-100 text-amber-800',
  unavailable: 'bg-red-100 text-red-700',
}

const decisionLabel: Record<string, string> = {
  partial: 'Sebagian Tersedia',
  unavailable: 'Tidak Tersedia',
}

export default function RejectReportTable({ rows }: RejectReportTableProps) {
  const [search, setSearch] = useState('')
    const [decisionFilter, setDecisionFilter] = useState(
    'all' as 'all' | 'partial' | 'unavailable'
  )
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

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (decisionFilter !== 'all' && row.decision !== decisionFilter) {
        return false
      }

      if (dateFrom && row.decidedAt) {
        const rowDate = new Date(row.decidedAt)
        const fromDate = new Date(`${dateFrom}T00:00:00`)
        if (rowDate < fromDate) return false
      }

      if (dateTo && row.decidedAt) {
        const rowDate = new Date(row.decidedAt)
        const toDate = new Date(`${dateTo}T23:59:59`)
        if (rowDate > toDate) return false
      }

      if (keyword) {
        const haystack = [
          row.customer,
          row.pkNumber || '',
          row.rftTrJob || '',
          row.decisionNote || '',
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(keyword)) return false
      }

      return true
    })
  }, [rows, search, decisionFilter, dateFrom, dateTo])

  function handleExport() {
    const exportRows = filteredRows.map((row) => ({
      Tanggal: formatDateLabel(row.decidedAt),
      Customer: row.customer,
      'Nomor PK': row.pkNumber || '-',
      'RFT / TR / Job': row.rftTrJob || '-',
      'Kebutuhan Unit': row.requirements
        .map((req) => `${req.vehicle_type} x${req.quantity}`)
        .join(', '),
      Keputusan: decisionLabel[row.decision],
      Catatan: row.decisionNote || '-',
      'Diputuskan Oleh': row.decidedByName,
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reject Report')

    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `reject-report-${today}.xlsx`)
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
            placeholder="Cari customer, PK, RFT, catatan..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={decisionFilter}
            onChange={(event) =>
              setDecisionFilter(
                event.target.value as 'all' | 'partial' | 'unavailable'
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          >
            <option value="all">Semua Keputusan</option>
            <option value="partial">Sebagian Tersedia</option>
            <option value="unavailable">Tidak Tersedia</option>
          </select>

          <button
            type="button"
            onClick={handleExport}
            disabled={!filteredRows.length}
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
                activePreset === preset.key
                  ? 'bg-[#2563EB] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
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
        Menampilkan {filteredRows.length} dari {rows.length} entri
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Customer
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                PK / RFT
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Kebutuhan Unit
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Keputusan
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Catatan
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Diputuskan Oleh
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tanggal
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {!filteredRows.length ? (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Inbox className="h-6 w-6" />
                    <span className="text-sm">
                      Tidak ada entri yang cocok dengan pencarian/filter ini.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/manager/orders/${row.id}`}
                      className="font-bold text-gray-900 hover:underline"
                    >
                      {row.customer}
                    </Link>
                  </td>

                  <td className="px-5 py-3.5 text-gray-700">
                    <p className="font-semibold">{row.pkNumber || '-'}</p>
                    <p className="text-[11px] text-gray-400">
                      {row.rftTrJob || '-'}
                    </p>
                  </td>

                  <td className="px-5 py-3.5 text-gray-700">
                    {row.requirements.length
                      ? row.requirements
                          .map((req) => `${req.vehicle_type} x${req.quantity}`)
                          .join(', ')
                      : `${row.quantity} Unit`}
                  </td>

                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        decisionBadge[row.decision]
                      }`}
                    >
                      {decisionLabel[row.decision]}
                    </span>
                  </td>

                  <td className="max-w-[220px] px-5 py-3.5 text-gray-600">
                    <span className="line-clamp-2">
                      {row.decisionNote || '-'}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-gray-700">
                    {row.decidedByName}
                  </td>

                  <td className="px-5 py-3.5 text-gray-500">
                    {formatDateLabel(row.decidedAt)}
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