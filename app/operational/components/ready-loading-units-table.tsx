'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import UnitProcessing from './unit-processing'

type Truck = {
  id: string
  order_id: string
  vehicle_type: string
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  status: string
  surat_jalan_distributed: boolean
  uang_jalan_distributed: boolean
}

type ReadyLoadingUnitsTableProps = {
  units: Truck[]
}

type FilterKey = 'all' | 'incomplete' | 'sj_missing' | 'uj_missing' | 'complete'

export default function ReadyLoadingUnitsTable({
  units,
}: ReadyLoadingUnitsTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Modal otomatis tertutup kalau unit yang lagi dibuka
  // sudah tidak ada lagi di daftar (misal sudah pindah
  // status ke ready_to_depart setelah disimpan).
  useEffect(() => {
    if (selectedId && !units.some((unit) => unit.id === selectedId)) {
      setSelectedId(null)
    }
  }, [units, selectedId])

  const total = units.length
  const completeCount = units.filter(
    (unit) => unit.surat_jalan_distributed && unit.uang_jalan_distributed
  ).length
  const sjMissingCount = units.filter(
    (unit) => !unit.surat_jalan_distributed
  ).length
  const ujMissingCount = units.filter(
    (unit) => !unit.uang_jalan_distributed
  ).length

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'Semua', count: total },
    {
      key: 'incomplete',
      label: 'Belum Lengkap',
      count: total - completeCount,
    },
    { key: 'sj_missing', label: 'SJ Belum', count: sjMissingCount },
    { key: 'uj_missing', label: 'UJ Belum', count: ujMissingCount },
    { key: 'complete', label: 'Lengkap', count: completeCount },
  ]

  const filteredUnits = units.filter((unit) => {
    const isComplete =
      unit.surat_jalan_distributed && unit.uang_jalan_distributed

    if (filter === 'complete') return isComplete
    if (filter === 'incomplete') return !isComplete
    if (filter === 'sj_missing') return !unit.surat_jalan_distributed
    if (filter === 'uj_missing') return !unit.uang_jalan_distributed
    return true
  })

  const selectedUnit = units.find((unit) => unit.id === selectedId) || null

  function getRowStatus(unit: Truck) {
    if (unit.surat_jalan_distributed && unit.uang_jalan_distributed) {
      return {
        label: 'Lengkap',
        className: 'bg-emerald-100 text-emerald-700',
      }
    }
    if (unit.surat_jalan_distributed && !unit.uang_jalan_distributed) {
      return { label: 'SJ Saja', className: 'bg-amber-100 text-amber-800' }
    }
    if (!unit.surat_jalan_distributed && unit.uang_jalan_distributed) {
      return { label: 'UJ Saja', className: 'bg-amber-100 text-amber-800' }
    }
    return { label: 'Belum', className: 'bg-gray-100 text-gray-600' }
  }

  return (
    <div className="mb-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">
          Unit Siap Diproses
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Unit yang sudah Passed HSE — konfirmasi Surat Jalan &amp; Uang
          Jalan per unit sebelum Ready to Depart.
        </p>
      </div>

      {/* SUMMARY */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
        <span className="text-sm font-bold text-gray-900">
          {total} Total Unit
        </span>
        <span className="h-4 w-px bg-gray-200" />
        <span className="text-sm text-emerald-700">
          {completeCount} Lengkap
        </span>
        <span className="text-sm text-amber-700">
          {total - completeCount} Belum Lengkap
        </span>
      </div>

      {/* FILTER */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === item.key
                ? 'bg-[#01236A] text-white'
                : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {item.label}
            <span
              className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${
                filter === item.key
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* COMPACT TABLE */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Unit
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Driver
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  SJ
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  UJ
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filteredUnits.map((unit) => {
                const rowStatus = getRowStatus(unit)

                return (
                  <tr
                    key={unit.id}
                    className="transition-colors hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900">
                        {unit.vehicle_type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {unit.plate_number || '-'}
                      </p>
                    </td>

                    <td className="px-5 py-3.5 text-gray-700">
                      {unit.driver_name || '-'}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      {unit.surat_jalan_distributed ? (
                        <CheckCircle2 className="mx-auto h-4.5 w-4.5 text-emerald-600" />
                      ) : (
                        <Circle className="mx-auto h-4.5 w-4.5 text-gray-300" />
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      {unit.uang_jalan_distributed ? (
                        <CheckCircle2 className="mx-auto h-4.5 w-4.5 text-emerald-600" />
                      ) : (
                        <Circle className="mx-auto h-4.5 w-4.5 text-gray-300" />
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${rowStatus.className}`}
                      >
                        {rowStatus.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(unit.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#01236A] hover:underline"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {!filteredUnits.length && (
            <div className="p-10 text-center text-sm text-gray-400">
              Tidak ada unit di kategori ini.
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETAIL — UnitProcessing ASLI, TIDAK DIUBAH */}
      {selectedUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-transparent"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <UnitProcessing truck={selectedUnit} />
          </div>
        </div>
      )}
    </div>
  )
}