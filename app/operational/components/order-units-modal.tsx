'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Eye, ArrowUpRight } from 'lucide-react'

type UnitRow = {
  id: string
  vehicle_type: string
  source: string | null
  status: string | null
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
}

type OrderUnitsModalProps = {
  orderId: string
  customer: string
  pkNumber: string | null
  units: UnitRow[]
}

function getStatusBadge(status: string | null) {
  const label = status || '-'

  const classMap: Record<string, string> = {
    ready_to_depart: 'bg-violet-100 text-violet-700',
    ready_loading: 'bg-emerald-100 text-emerald-700',
    vm: 'bg-violet-100 text-violet-700',
    failed: 'bg-red-100 text-red-700',
    waiting_hse: 'bg-amber-100 text-amber-800',
    inspection: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  const className = classMap[status || ''] || 'bg-gray-100 text-gray-600'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}
    >
      {label}
    </span>
  )
}

export default function OrderUnitsModal({
  orderId,
  customer,
  pkNumber,
  units,
}: OrderUnitsModalProps) {
  const [open, setOpen] = useState(false)

  const activeUnits = units.filter((unit) => unit.status !== 'cancelled')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85"
      >
        <Eye className="h-3.5 w-3.5" />
        Lihat Detail
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {customer}
                </h3>
                <p className="text-xs text-gray-400">
                  PK {pkNumber || '-'} · {activeUnits.length} Unit
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Unit
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      No. Buntut
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Plat
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Driver
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {activeUnits.map((unit, index) => (
                    <tr key={unit.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-gray-900">
                          {unit.vehicle_type}
                        </p>
                        <p className="text-xs text-gray-400">
                          {unit.source === 'vendor'
                            ? 'Vendor / VM'
                            : `Internal ${index + 1}`}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {unit.no_buntut || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {unit.plate_number || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {unit.driver_name || '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {getStatusBadge(unit.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!activeUnits.length && (
                <div className="p-8 text-center text-sm text-gray-400">
                  Tidak ada unit.
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <Link
                href={`/operational/orders/${orderId}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#01236A] hover:underline"
              >
                Buka Detail Order Lengkap
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}