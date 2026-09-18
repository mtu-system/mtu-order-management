'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  ShieldCheck,
  PackageCheck,
  Truck,
  AlertTriangle,
  Inbox,
  ArrowRight,
} from 'lucide-react'

type TodayOrderRow = {
  id: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  quantity: number
  trip: string | null
  statusLabel: string
  statusClass: string
}

type TruckRow = {
  id: string
  orderId: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  trip: string | null
  vehicleType: string
  noBuntut: string | null
  plateNumber: string | null
  driverName: string | null
  driverPhone: string | null
}

type MarketingDashboardPanelProps = {
  todayOrders: TodayOrderRow[]
  waitingHseUnits: TruckRow[]
  readyLoadingUnits: TruckRow[]
  readyDepartUnits: TruckRow[]
  failedUnits: TruckRow[]
}

type Tab = 'today' | 'waiting_hse' | 'ready_loading' | 'ready_depart' | 'failed'

function TruckTable({
  rows,
  statusLabel,
  statusClass,
  emptyLabel,
}: {
  rows: TruckRow[]
  statusLabel: string
  statusClass: string
  emptyLabel: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Customer
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              PK / RFT
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Unit
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              No. Buntut
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Plat
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Driver
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Trip
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {rows.map((truck) => (
            <tr key={truck.id} className="transition-colors hover:bg-gray-50/60">
              <td className="px-6 py-4">
                <Link
                  href={`/marketing/orders/${truck.orderId}`}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {truck.customer}
                </Link>
              </td>
              <td className="px-6 py-4">
                <div className="text-gray-900">{truck.pkNumber || '-'}</div>
                <div className="text-xs text-gray-400">
                  {truck.rftTrJob || '-'}
                </div>
              </td>
              <td className="px-6 py-4 font-semibold text-gray-900">
                {truck.vehicleType}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {truck.noBuntut || '-'}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {truck.plateNumber || '-'}
              </td>
              <td className="px-6 py-4">
                <div className="text-gray-900">{truck.driverName || '-'}</div>
                <div className="text-xs text-gray-400">
                  {truck.driverPhone || '-'}
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">{truck.trip || '-'}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!rows.length && (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-400">{emptyLabel}</p>
        </div>
      )}
    </div>
  )
}

export default function MarketingDashboardPanel({
  todayOrders,
  waitingHseUnits,
  readyLoadingUnits,
  readyDepartUnits,
  failedUnits,
}: MarketingDashboardPanelProps) {
  const [tab, setTab] = useState('today' as Tab)

  const kpiItems = [
    {
      key: 'today' as Tab,
      label: 'Order Hari Ini',
      value: todayOrders.length,
      icon: ClipboardList,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      key: 'waiting_hse' as Tab,
      label: 'Waiting HSE',
      value: waitingHseUnits.length,
      icon: ShieldCheck,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      key: 'ready_loading' as Tab,
      label: 'Menunggu SJ/UJ',
      value: readyLoadingUnits.length,
      icon: PackageCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'ready_depart' as Tab,
      label: 'Ready to Depart',
      value: readyDepartUnits.length,
      icon: Truck,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      key: 'failed' as Tab,
      label: 'Failed',
      value: failedUnits.length,
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
      valueColor: 'text-red-600',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {kpiItems.map((item) => {
          const Icon = item.icon
          const isActive = tab === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
                isActive
                  ? 'border-blue-500 ring-1 ring-blue-500/20'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${item.iconBg} ${item.iconColor}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
              <p
                className={`mt-1.5 text-2xl font-extrabold ${
                  item.valueColor || 'text-gray-900'
                }`}
              >
                {item.value}
              </p>
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-bold text-gray-900">
            {kpiItems.find((item) => item.key === tab)?.label}
          </h2>
        </div>

        {tab === 'today' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    PK / RFT
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Quantity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Trip
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {todayOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {order.customer}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">
                        {order.pkNumber || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {order.rftTrJob || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {order.quantity} Unit
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {order.trip || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${order.statusClass}`}
                      >
                        {order.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/marketing/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Detail
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!todayOrders.length && (
              <div className="flex flex-col items-center gap-3 p-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-400">
                  Belum ada order yang dibuat hari ini.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'waiting_hse' && (
          <TruckTable
            rows={waitingHseUnits}
            statusLabel="Waiting HSE"
            statusClass="bg-blue-100 text-blue-700"
            emptyLabel="Tidak ada unit yang menunggu pemeriksaan HSE."
          />
        )}

        {tab === 'ready_loading' && (
          <TruckTable
            rows={readyLoadingUnits}
            statusLabel="Menunggu SJ/UJ"
            statusClass="bg-blue-100 text-blue-700"
            emptyLabel="Tidak ada unit yang menunggu SJ/UJ."
          />
        )}

        {tab === 'ready_depart' && (
          <TruckTable
            rows={readyDepartUnits}
            statusLabel="Ready to Depart"
            statusClass="bg-emerald-100 text-emerald-700"
            emptyLabel="Belum ada unit yang Ready to Depart."
          />
        )}

        {tab === 'failed' && (
          <TruckTable
            rows={failedUnits}
            statusLabel="Failed"
            statusClass="bg-red-100 text-red-700"
            emptyLabel="Tidak ada unit yang Failed."
          />
        )}
      </div>
    </div>
  )
}