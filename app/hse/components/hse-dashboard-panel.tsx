'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  ArrowRight,
} from 'lucide-react'

type HseOrderRow = {
  id: string
  customer: string
  avatarClass: string
  pkNumber: string | null
  rftTrJob: string | null
  trip: string | null
  vehicleSummary: string
  total: number
  passed: number
  waiting: number
  failed: number
}

type HseDashboardPanelProps = {
  orders: HseOrderRow[]
}

type Tab = 'waiting' | 'passed' | 'failed'

export default function HseDashboardPanel({ orders }: HseDashboardPanelProps) {
  const [tab, setTab] = useState('waiting' as Tab)

  const waitingOrders = orders.filter((order) => order.waiting > 0)
  const passedOrders = orders.filter((order) => order.passed > 0)
  const failedOrders = orders.filter((order) => order.failed > 0)

  const totalWaitingUnits = orders.reduce((sum, o) => sum + o.waiting, 0)
  const totalPassedUnits = orders.reduce((sum, o) => sum + o.passed, 0)
  const totalFailedUnits = orders.reduce((sum, o) => sum + o.failed, 0)

  const kpiItems = [
    {
      key: 'waiting' as Tab,
      label: 'Waiting Inspection',
      value: totalWaitingUnits,
      icon: ShieldCheck,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      key: 'passed' as Tab,
      label: 'Passed',
      value: totalPassedUnits,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'failed' as Tab,
      label: 'Failed',
      value: totalFailedUnits,
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-600',
    },
  ]

  const activeRows =
    tab === 'waiting'
      ? waitingOrders
      : tab === 'passed'
      ? passedOrders
      : failedOrders

  const emptyLabel =
    tab === 'waiting'
      ? 'Tidak ada unit yang menunggu pemeriksaan HSE.'
      : tab === 'passed'
      ? 'Belum ada unit yang Passed HSE.'
      : 'Tidak ada unit yang Failed.'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpiItems.map((item) => {
          const Icon = item.icon
          const isActive = tab === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                isActive
                  ? 'border-[#01236A] ring-1 ring-[#01236A]/20'
                  : 'border-gray-100 hover:border-[#01236A]/30'
              }`}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${item.iconBg} ${item.iconColor}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p
                className={`mt-1 text-3xl font-bold ${
                  item.valueColor || 'text-gray-900'
                }`}
              >
                {item.value}
              </p>
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  PK / RFT
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kendaraan
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Trip
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {activeRows.map((order) => (
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
                    <div className="text-gray-900">
                      {order.pkNumber || '-'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {order.rftTrJob || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {order.vehicleSummary || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">
                      {order.passed} / {order.total} Passed
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {order.waiting} Waiting
                      {order.failed > 0 && <>{' · '}{order.failed} Failed</>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {order.trip || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/hse/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
                    >
                      Detail
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!activeRows.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">{emptyLabel}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}