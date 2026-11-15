
'use client'

import { useState } from 'react'
import Link from 'next/link'
import StatCard from '@/app/components/stat-card'
import type { StatTone } from '@/app/components/stat-card'
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

const TONE_BY_KEY: Record<string, StatTone> = {
  all: 'navy',
  waiting_unit: 'amber',
  waiting_hse: 'blue',
  ready_loading: 'green',
  ready_to_depart: 'violet',
}

const HINT_BY_KEY: Record<string, string> = {
  all: 'Seluruh order',
  waiting_unit: 'Menunggu proses',
  waiting_hse: 'Sedang berjalan',
  ready_loading: 'Unit terpasang',
  ready_to_depart: 'Siap jalan',
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
      return (
        order.status === 'waiting_hse' ||
        order.status === 'inspection'
      )
    }

    return order.status === activeKey
  })

  const activeLabel =
    kpiItems.find((item) => item.key === activeKey)?.label ||
    'Total Order'

  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">

        {kpiItems.map((item) => {
          const Icon =
            iconMap[item.key as keyof typeof iconMap] || ClipboardList

          return (
            <StatCard
              key={item.key}
              label={item.label}
              value={item.value}
              hint={HINT_BY_KEY[item.key]}
              icon={Icon}
              tone={TONE_BY_KEY[item.key] || 'navy'}
              active={activeKey === item.key}
              onClick={() => setActiveKey(item.key)}
            />
          )
        })}

        <StatCard
          label={attentionItem.label}
          value={attentionItem.value}
          hint="Perlu tindakan"
          icon={AlertTriangle}
          tone="red"
          alert={attentionItem.value > 0}
          onClick={() => {
            const target = document.getElementById('needs-attention')

            if (target) {
              target.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          }}
        />

      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-bold text-gray-900">
            {activeLabel}
          </h2>
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
                <tr
                  key={order.id}
                  className="hover:bg-gray-50/60"
                >
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
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
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
          <div className="border-t border-gray-200 px-5 py-2.5 text-center">
            <Link
              href="/manager/orders"
              className="text-xs font-bold text-[#2563EB] hover:underline"
            >
              Lihat semua {filteredOrders.length} order di halaman Orders
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
