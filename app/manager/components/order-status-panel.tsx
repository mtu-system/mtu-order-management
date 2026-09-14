'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Inbox,
  ArrowRight,
  ClipboardList,
  Loader2,
  PackageCheck,
  Truck,
  AlertTriangle,
} from 'lucide-react'

const iconMap = {
  all: ClipboardList,
  waiting_unit: Inbox,
  waiting_hse: Loader2,
  ready_loading: PackageCheck,
  ready_to_depart: Truck,
}

type OrderRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  trip: string | null
  quantity: number
  status: string
  statusLabel: string
  statusClass: string
  dateLabel: string
}

type KpiItem = {
  key: string
  label: string
  value: number
  color: string
}

type AttentionItem = {
  label: string
  value: number
  color: string
  href: string
}

type OrderStatusPanelProps = {
  orders: OrderRow[]
  kpiItems: KpiItem[]
  attentionItem: AttentionItem
}

export default function OrderStatusPanel({
  orders,
  kpiItems,
  attentionItem,
}: OrderStatusPanelProps) {
  const [activeKey, setActiveKey] = useState('all')

  const filteredOrders = orders.filter((order) => {
    if (activeKey === 'all') return true
    if (activeKey === 'waiting_hse') {
      return order.status === 'waiting_hse' || order.status === 'inspection'
    }
    return order.status === activeKey
  })

  const activeLabel =
    kpiItems.find((item) => item.key === activeKey)?.label || 'Total Order'

  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 divide-x divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm sm:grid-cols-3 lg:grid-cols-6">
             {kpiItems.map((item) => {
          const Icon = iconMap[item.key as keyof typeof iconMap] || ClipboardList
          const isActive = activeKey === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveKey(item.key)}
              className={`flex items-center gap-3 px-5 py-4 text-left transition-colors ${
                isActive ? 'bg-[#01236A]/5' : 'hover:bg-gray-50/60'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-lg font-bold leading-tight text-gray-900">
                  {item.value}
                </p>
                <p className="text-[11px] font-medium leading-tight text-gray-500">
                  {item.label}
                </p>
              </div>
            </button>
          )
        })}

        
                 <button
          type="button"
          onClick={() => {
            const target = document.getElementById('needs-attention')
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className="flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/60"
        >
          <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${attentionItem.color}`} />
          <div>
            <p className="text-lg font-bold leading-tight text-gray-900">
              {attentionItem.value}
            </p>
            <p className="text-[11px] font-medium leading-tight text-gray-500">
              {attentionItem.label}
            </p>
          </div>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-bold text-gray-900">{activeLabel}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Customer
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  PK / RFT
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Quantity
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Trip
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Status
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Dibuat
                </th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filteredOrders.slice(0, 20).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-2.5 font-semibold text-gray-900">
                    {order.customer}
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">
                    <div>{order.pkNumber || '-'}</div>
                    <div className="text-[11px] text-gray-400">
                      {order.rftTrJob || '-'}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">
                    {order.quantity} Unit
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">
                    {order.trip || '-'}
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${order.statusClass}`}
                    >
                      {order.statusLabel}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-gray-500">
                    {order.dateLabel}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Link
                      href={`/manager/orders/${order.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#01236A] hover:underline"
                    >
                      Detail
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredOrders.length && (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-sm text-gray-400">
                Tidak ada order untuk kategori ini.
              </p>
            </div>
          )}
        </div>

        {filteredOrders.length > 20 && (
          <div className="border-t border-gray-100 px-5 py-2.5 text-center">
            <Link
              href="/manager/orders"
              className="text-xs font-bold text-[#01236A] hover:underline"
            >
              Lihat semua {filteredOrders.length} order di halaman Orders
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}