'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type OrderRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  orderType: string | null
  vehicleText: string
  activeQuantity: number
  internalCount: number
  readyToDepartCount: number
  readyLoadingCount: number
  waitingHseCount: number
  vmCount: number
  trip: string | null
  status: string | null
  avatarClass: string
  reduceUnitRequested: boolean
  reduceUnitQuantity: number | null
  reduceUnitVehicleType: string | null
}

type OrdersTableProps = {
  orders: OrderRow[]
}

type FilterKey = 'all' | 'RFT' | 'PK'

function statusStyle(status: string | null) {
  switch (status) {
    case 'waiting_unit':
      return 'bg-amber-100 text-amber-800'
    case 'waiting_hse':
    case 'inspection':
      return 'bg-blue-100 text-blue-800'
    case 'ready_loading':
      return 'bg-emerald-100 text-emerald-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function statusLabel(status: string | null) {
  return (
    status
      ?.replaceAll('_', ' ')
      .replace(/\b\w/g, (char: string) => char.toUpperCase()) || 'Unknown'
  )
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const counts = useMemo(
    () => ({
      all: orders.length,
      RFT: orders.filter((order) => order.orderType === 'RFT').length,
      PK: orders.filter((order) => order.orderType === 'PK').length,
    }),
    [orders]
  )

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders
    return orders.filter((order) => order.orderType === filter)
  }, [orders, filter])

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'RFT', label: 'RFT' },
    { key: 'PK', label: 'PK' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-1 border-b border-gray-100 px-6 py-3">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === item.key
                ? 'bg-[#01236A] text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {item.label}
            <span
              className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${
                filter === item.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {counts[item.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Customer
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                PK / RFT
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Kendaraan
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Progress
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quantity
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Trip
              </th>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {!filteredOrders.length ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-14 text-center text-sm text-gray-400"
                >
                  Tidak ada order untuk filter ini.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${order.avatarClass}`}
                      >
                        {order.customer.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">
                        {order.customer}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Link
                      href={`/marketing/orders/${order.id}`}
                      className="block hover:underline"
                    >
                      <div className="font-semibold text-[#01236A]">
                        {order.pkNumber || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.rftTrJob || '-'}
                      </div>
                    </Link>
                  </td>

                  <td className="px-6 py-4 text-gray-600">
                    {order.vehicleText || '-'}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.internalCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          {order.readyToDepartCount}/{order.internalCount}{' '}
                          Ready to Depart
                        </span>
                      )}

                      {order.readyLoadingCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {order.readyLoadingCount} Menunggu SJ/UJ
                        </span>
                      )}

                      {order.waitingHseCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {order.waitingHseCount} Waiting HSE
                        </span>
                      )}

                      {order.vmCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          VM {order.vmCount}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">
                      {order.activeQuantity} Unit
                    </div>

                    {order.reduceUnitRequested && (
                      <div className="mt-1">
                        <div className="text-xs font-semibold text-orange-600">
                          -{order.reduceUnitQuantity} Unit{' '}
                          {order.reduceUnitVehicleType}
                        </div>
                        <div className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                          Menunggu Operational
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="max-w-xs px-6 py-4">
                    <p className="truncate text-gray-600">
                      {order.trip || '-'}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusStyle(
                        order.status
                      )}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/marketing/orders/${order.id}`}
                      className="text-sm font-semibold text-[#01236A] hover:underline"
                    >
                      Detail
                    </Link>
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