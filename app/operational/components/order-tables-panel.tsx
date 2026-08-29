'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Inbox,
  MinusCircle,
  PlusCircle,
  History as HistoryIcon,
} from 'lucide-react'

type ActiveOrderRow = {
  id: string
  avatarClass: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  vehicleText: string
  operationalQuantity: number
  filledCount: number
  vmCount: number
  unavailableCount: number
  statusLabel: string
  statusClass: string
  historyCount: number
  reduceRequests: { id: string; quantity: number }[]
  addRequests: { id: string; quantity: number }[]
}

type ReadyUnitRow = {
  id: string
  orderId: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  vehicleType: string
  noBuntut: string | null
  driverName: string | null
}

type ReadyToDepartRow = {
  id: string
  orderId: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  vehicleType: string
  noBuntut: string | null
  plateNumber: string | null
  driverName: string | null
}

type OrderTablesPanelProps = {
  activeOrders: ActiveOrderRow[]
  readyUnits: ReadyUnitRow[]
  readyToDepartUnits: ReadyToDepartRow[]
}

type Tab = 'active' | 'ready' | 'depart'

export default function OrderTablesPanel({
  activeOrders,
  readyUnits,
  readyToDepartUnits,
}: OrderTablesPanelProps) {
  const [tab, setTab] = useState<Tab>('active')

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Order Aktif', count: activeOrders.length },
    { key: 'ready', label: 'Menunggu SJ/UJ', count: readyUnits.length },
    {
      key: 'depart',
      label: 'Ready to Depart',
      count: readyToDepartUnits.length,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* TAB BAR */}
      <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50/60 px-3 pt-3">
        {tabs.map((item) => {
          const isActive = tab === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-bold transition ${
                isActive
                  ? 'bg-white text-[#01236A] shadow-[0_-1px_0_0_#f3f4f6]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
              <span
                className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  isActive
                    ? 'bg-[#01236A]/10 text-[#01236A]'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ORDER AKTIF */}
      {tab === 'active' && (
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
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Unit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Perubahan
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {activeOrders.map((order) => (
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
                    {order.vehicleText || '-'}
                  </td>

                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {order.operationalQuantity} Unit
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900">
                          {order.filledCount}/{order.operationalQuantity}
                        </span>

                        {order.vmCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                            VM {order.vmCount}
                          </span>
                        )}

                        {order.unavailableCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            Tidak Tersedia {order.unavailableCount}
                          </span>
                        )}
                      </div>

                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#01236A]"
                          style={{
                            width: `${Math.min(
                              100,
                              (order.filledCount /
                                Math.max(order.operationalQuantity, 1)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${order.statusClass}`}
                      >
                        {order.statusLabel}
                      </span>

                      {order.historyCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400">
                          <HistoryIcon className="h-3 w-3" />
                          {order.historyCount} riwayat
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {order.reduceRequests.map((request) => (
                        <span
                          key={request.id}
                          className="inline-flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700"
                        >
                          <MinusCircle className="h-3 w-3" />
                          {request.quantity} Unit
                        </span>
                      ))}

                      {order.addRequests.map((request) => (
                        <span
                          key={request.id}
                          className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700"
                        >
                          <PlusCircle className="h-3 w-3" />
                          {request.quantity} Unit
                        </span>
                      ))}

                      {!order.reduceRequests.length &&
                        !order.addRequests.length && (
                          <span className="text-gray-300">-</span>
                        )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/operational/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
                    >
                      Proses
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!activeOrders.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">Tidak ada order aktif.</p>
            </div>
          )}
        </div>
      )}

      {/* MENUNGGU SJ/UJ */}
      {tab === 'ready' && (
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
                  Unit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  No. Buntut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Driver
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
              {readyUnits.map((truck) => (
                <tr
                  key={truck.id}
                  className="transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {truck.customer || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">
                      {truck.pkNumber || '-'}
                    </div>
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
                    {truck.driverName || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      Menunggu SJ/UJ
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/operational/orders/${truck.orderId}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#01236A] hover:underline"
                    >
                      Proses
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!readyUnits.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">
                Belum ada unit yang Passed HSE.
              </p>
            </div>
          )}
        </div>
      )}

      {/* READY TO DEPART */}
      {tab === 'depart' && (
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
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {readyToDepartUnits.map((truck) => (
                <tr
                  key={truck.id}
                  className="transition-colors hover:bg-gray-50/60"
                >
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {truck.customer || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">
                      {truck.pkNumber || '-'}
                    </div>
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
                  <td className="px-6 py-4 text-gray-600">
                    {truck.driverName || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                      Ready to Depart
                    </span>
                    <div className="mt-1 text-[11px] text-gray-400">
                      SJ + UJ sudah dibagikan
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!readyToDepartUnits.length && (
            <div className="flex flex-col items-center gap-3 p-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-400">
                Belum ada unit yang Ready to Depart.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}