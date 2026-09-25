'use client'

import { useMemo, useState } from 'react'
import { Inbox, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import Link from 'next/link'

type ReportRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  bookingDate: string | null
  totalQuantity: number
  requirements: { vehicle_type: string; quantity: number }[]
  status: string
  result: 'activated' | 'rejected' | 'cancelled' | 'confirmed' | 'review'
  decision: 'available' | 'partial' | 'unavailable' | null
  decisionNote: string | null
  decidedByName: string
  decidedAt: string | null
  breakdown: {
    vehicle_type: string
    internal: number
    vendor: number
    unavailable: number
  }[]
}

type BookingReportTableProps = {
  rows: ReportRow[]
}

const resultBadge: Record<string, string> = {
  activated: 'bg-emerald-100 text-emerald-700',
  confirmed: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-600',
  review: 'bg-amber-100 text-amber-800',
}

const resultLabel: Record<string, string> = {
  activated: 'Diambil & Dijalankan',
  confirmed: 'Mumpuni · Menunggu Marketing',
  rejected: 'Ditolak Operational',
  cancelled: 'Dibatalkan Marketing',
  review: 'Menunggu Cek Kapasitas',
}

function formatDateLabel(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTimeLabel(iso: string | null) {
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

export default function BookingReportTable({ rows }: BookingReportTableProps) {
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState<'all' | ReportRow['result']>(
    'all'
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (resultFilter !== 'all' && row.result !== resultFilter) {
        return false
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
  }, [rows, search, resultFilter])

  function handleExport() {
    const exportRows = filteredRows.map((row) => ({
      'Tanggal Kebutuhan': formatDateLabel(row.bookingDate),
      Customer: row.customer,
      'Nomor PK': row.pkNumber || '-',
      'RFT / TR / Job': row.rftTrJob || '-',
      'Kebutuhan Unit': row.requirements.length
        ? row.requirements
            .map((req) => `${req.vehicle_type} x${req.quantity}`)
            .join(', ')
        : `${row.totalQuantity} Unit`,
      Hasil: resultLabel[row.result],
      Breakdown: row.breakdown.length
        ? row.breakdown
            .map(
              (item) =>
                `${item.vehicle_type}: Internal ${item.internal} / Vendor ${item.vendor} / Tidak Tersedia ${item.unavailable}`
            )
            .join('; ')
        : '-',
      Catatan: row.decisionNote || '-',
      'Dicek Oleh': row.decidedByName,
      'Tanggal Dicek': formatDateTimeLabel(row.decidedAt),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Booking Report')

    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `booking-report-${today}.xlsx`)
  }

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
            value={resultFilter}
            onChange={(event) =>
              setResultFilter(event.target.value as 'all' | ReportRow['result'])
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
          >
            <option value="all">Semua Hasil</option>
            <option value="activated">Diambil & Dijalankan</option>
            <option value="confirmed">Mumpuni · Menunggu Marketing</option>
            <option value="rejected">Ditolak Operational</option>
            <option value="cancelled">Dibatalkan Marketing</option>
            <option value="review">Menunggu Cek Kapasitas</option>
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

      <div className="border-b border-gray-200 px-6 py-2 text-xs text-gray-400">
        Menampilkan {filteredRows.length} dari {rows.length} booking
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tanggal Kebutuhan
              </th>
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
                Breakdown
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Hasil
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Catatan
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Dicek Oleh
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {!filteredRows.length ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Inbox className="h-6 w-6" />
                    <span className="text-sm">
                      Tidak ada booking yang cocok dengan pencarian/filter
                      ini.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3.5 font-semibold text-gray-900">
                    {formatDateLabel(row.bookingDate)}
                  </td>

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
                      : `${row.totalQuantity} Unit`}
                  </td>

                  <td className="px-5 py-3.5 text-gray-600">
                    {row.breakdown.length ? (
                      <div className="space-y-0.5 text-[11px]">
                        {row.breakdown.map((item) => (
                          <div key={item.vehicle_type}>
                            <span className="font-semibold">
                              {item.vehicle_type}:
                            </span>{' '}
                            Internal {item.internal} · Vendor {item.vendor}
                            {item.unavailable > 0
                              ? ` · Tidak Tersedia ${item.unavailable}`
                              : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${resultBadge[row.result]}`}
                    >
                      {resultLabel[row.result]}
                    </span>
                  </td>

                  <td className="max-w-[220px] px-5 py-3.5 text-gray-600">
                    <span className="line-clamp-2">
                      {row.decisionNote || '-'}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-gray-700">
                    <p>{row.decidedByName}</p>
                    <p className="text-[11px] text-gray-400">
                      {formatDateTimeLabel(row.decidedAt)}
                    </p>
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
