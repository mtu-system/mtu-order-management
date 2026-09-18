'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Trophy, AlertTriangle } from 'lucide-react'

type OrderRow = {
  id: string
  customer: string
  createdAt: string
  isRejected: boolean
}

type CustomerRankingTableProps = {
  rows: OrderRow[]
}

type DatePreset = 'all' | '7d' | '30d' | 'month' | 'custom'

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

type RankedCustomer = {
  customer: string
  count: number
}

function RankingPanel({
  title,
  icon,
  accentClass,
  barClass,
  items,
  emptyLabel,
  countLabel,
}: {
  title: string
  icon: ReactNode
  accentClass: string
  barClass: string
  items: RankedCustomer[]
  emptyLabel: string
  countLabel: string
}) {
  const maxCount = items.length > 0 ? items[0].count : 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3">
        <span className={accentClass}>{icon}</span>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-4 px-5 py-5">
          {items.map((item, index) => {
            const widthPercent = maxCount
              ? Math.max((item.count / maxCount) * 100, 6)
              : 0

            return (
              <div key={item.customer}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-semibold text-gray-800">
                      {item.customer}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-gray-900">
                    {item.count} {countLabel}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${barClass}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CustomerRankingTable({
  rows,
}: CustomerRankingTableProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState('all' as DatePreset)

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
    return rows.filter((row) => {
      if (dateFrom) {
        const rowDate = new Date(row.createdAt)
        const fromDate = new Date(`${dateFrom}T00:00:00`)
        if (rowDate < fromDate) return false
      }

      if (dateTo) {
        const rowDate = new Date(row.createdAt)
        const toDate = new Date(`${dateTo}T23:59:59`)
        if (rowDate > toDate) return false
      }

      return true
    })
  }, [rows, dateFrom, dateTo])

  const { topCustomers, topRejected, totalOrders, totalRejected } =
    useMemo(() => {
      const orderCountMap = new Map<string, number>()
      const rejectedCountMap = new Map<string, number>()

      for (const row of filteredRows) {
        orderCountMap.set(
          row.customer,
          (orderCountMap.get(row.customer) || 0) + 1
        )

        if (row.isRejected) {
          rejectedCountMap.set(
            row.customer,
            (rejectedCountMap.get(row.customer) || 0) + 1
          )
        }
      }

      const topCustomers = Array.from(orderCountMap.entries())
        .map(([customer, count]) => ({ customer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const topRejected = Array.from(rejectedCountMap.entries())
        .map(([customer, count]) => ({ customer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return {
        topCustomers,
        topRejected,
        totalOrders: filteredRows.length,
        totalRejected: filteredRows.filter((row) => row.isRejected).length,
      }
    }, [filteredRows])

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'month', label: 'Bulan Ini' },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          <span className="text-xs font-semibold text-gray-400">
            Tanggal:
          </span>

          <div className="flex items-center gap-1 rounded-full bg-gray-50 p-1 ring-1 ring-inset ring-gray-200">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
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

        <div className="border-t border-gray-200 px-6 py-2 text-xs text-gray-400">
          {totalOrders} order dalam rentang ini, {totalRejected} di antaranya
          pernah reject (sebagian/seluruhnya).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingPanel
          title="Top 5 Customer"
          icon={<Trophy className="h-4 w-4" />}
          accentClass="text-amber-500"
          barClass="bg-[#2563EB]"
          items={topCustomers}
          emptyLabel="Belum ada order pada rentang tanggal ini."
          countLabel="order"
        />

        <RankingPanel
          title="Top 5 Rejected Customer"
          icon={<AlertTriangle className="h-4 w-4" />}
          accentClass="text-red-500"
          barClass="bg-red-500"
          items={topRejected}
          emptyLabel="Tidak ada order yang reject pada rentang tanggal ini."
          countLabel="reject"
        />
      </div>
    </div>
  )
}