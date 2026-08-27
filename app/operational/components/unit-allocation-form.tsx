'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Truck,
  Save,
  Loader2,
} from 'lucide-react'

type Requirement = {
  id: number | string
  vehicle_type: string
  quantity: number
}

type UnitAllocationFormProps = {
  orderId: string
  requirements: Requirement[]
}

type Allocation = {
  vehicle_type: string
  internal: number
  vendor: number
  unavailable: number
}

export default function UnitAllocationForm({
  orderId,
  requirements,
}: UnitAllocationFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [allocations, setAllocations] =
    useState<Allocation[]>(
      requirements.map((requirement) => ({
        vehicle_type: requirement.vehicle_type,
        internal: requirement.quantity,
        vendor: 0,
        unavailable: 0,
      }))
    )

  const [saving, setSaving] = useState(false)

  function updateAllocation(
    index: number,
    field:
      | 'internal'
      | 'vendor'
      | 'unavailable',
    value: string
  ) {
    const numberValue =
      value === '' ? 0 : Number(value)

    setAllocations((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                Number.isFinite(numberValue) &&
                numberValue >= 0
                  ? Math.floor(numberValue)
                  : 0,
            }
          : item
      )
    )
  }

  function getRequirementQuantity(
    vehicleType: string
  ) {
    return (
      requirements.find(
        (item) =>
          item.vehicle_type === vehicleType
      )?.quantity || 0
    )
  }

  function isValidAllocation(
    allocation: Allocation
  ) {
    const required =
      getRequirementQuantity(
        allocation.vehicle_type
      )

    return (
      allocation.internal +
        allocation.vendor +
        allocation.unavailable ===
      required
    )
  }

async function handleSubmit(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault()

  if (saving) return

  // ==========================================
  // VALIDASI ALOKASI
  // ==========================================

  for (const allocation of allocations) {
    const required =
      getRequirementQuantity(
        allocation.vehicle_type
      )

    const total =
      allocation.internal +
      allocation.vendor +
      allocation.unavailable

    if (total !== required) {
      alert(
        `${allocation.vehicle_type}: alokasi harus berjumlah ${required} unit. Saat ini ${total} unit.`
      )
      return
    }
  }

  setSaving(true)

  try {
    // ==========================================
    // CEK USER
    // ==========================================

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Session login tidak ditemukan.')
      return
    }

    // ==========================================
    // CEK APAKAH ORDER SUDAH PUNYA ALOKASI
    // ==========================================

    const {
      data: existingLogs,
      error: existingLogError,
    } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('order_id', orderId)
      .eq('action', 'UNIT_ALLOCATION')
      .limit(1)

    if (existingLogError) {
      console.error(
        'CHECK EXISTING ALLOCATION ERROR:',
        existingLogError
      )
    }

    // ==========================================
    // CEK APAKAH SUDAH ADA VM / INTERNAL
    // ==========================================

    const {
      data: existingTrucks,
      error: existingTruckError,
    } = await supabase
      .from('order_trucks')
      .select('id, source, status')
      .eq('order_id', orderId)

    if (existingTruckError) {
      console.error(
        'CHECK EXISTING TRUCK ERROR:',
        existingTruckError
      )
    }

    const hasExistingAllocation =
      (existingLogs?.length ?? 0) > 0 ||
      (existingTrucks?.length ?? 0) > 0

    if (hasExistingAllocation) {
      alert(
        'Alokasi untuk order ini sudah disimpan. Tidak dapat disimpan ulang.'
      )

      router.refresh()
      return
    }

    // ==========================================
    // SIMPAN ACTIVITY LOG
    // ==========================================

    const {
      error: logError,
    } = await supabase
      .from('activity_logs')
      .insert({
        order_id: orderId,
        user_id: user.id,
        action: 'UNIT_ALLOCATION',
        old_value: null,
        new_value:
          JSON.stringify(allocations),
      })

    if (logError) {
      console.error(
        'SAVE ALLOCATION LOG ERROR:',
        logError
      )

      alert(logError.message)
      return
    }

    // ==========================================
    // BUAT DATA VM
    //
    // SATU KALI INSERT
    // ==========================================

    const vmRows = allocations.flatMap(
      (allocation) =>
        Array.from(
          {
            length: allocation.vendor,
          },
          () => ({
            order_id: orderId,
            source: 'vendor',
            vehicle_type:
              allocation.vehicle_type,
            no_buntut: null,
plate_number: null,
driver_name: null,
driver_phone: null,
            vendor_name: 'Vendor / VM',
            status: 'vm',
          })
        )
    )

    if (vmRows.length > 0) {
      const {
        error: vmError,
      } = await supabase
        .from('order_trucks')
        .insert(vmRows)

      if (vmError) {
        console.error(
          'SAVE VM ERROR:',
          vmError
        )

        alert(vmError.message)
        return
      }
    }

    // ==========================================
    // STATUS ORDER
    // ==========================================

    const hasInternal =
      allocations.some(
        (allocation) =>
          allocation.internal > 0
      )

    const {
      error: orderError,
    } = await supabase
      .from('orders')
      .update({
        status: hasInternal
          ? 'waiting_hse'
          : 'ready_loading',
      })
      .eq('id', orderId)

    if (orderError) {
      console.error(
        'UPDATE ORDER STATUS ERROR:',
        orderError
      )

      alert(orderError.message)
      return
    }

    // ==========================================
    // SESSION STORAGE
    // ==========================================

    window.sessionStorage.setItem(
      `unit-allocation-${orderId}`,
      JSON.stringify(allocations)
    )

    // ==========================================
    // TOTAL
    // ==========================================

    const totalInternal =
      allocations.reduce(
        (total, allocation) =>
          total + allocation.internal,
        0
      )

    const totalVm =
      allocations.reduce(
        (total, allocation) =>
          total + allocation.vendor,
        0
      )

    const totalUnavailable =
      allocations.reduce(
        (total, allocation) =>
          total + allocation.unavailable,
        0
      )

    alert(
      `Alokasi berhasil disimpan.\n\n` +
      `Internal: ${totalInternal} Unit\n` +
      `VM: ${totalVm} Unit\n` +
      `Tidak Tersedia: ${totalUnavailable} Unit`
    )

    router.refresh()

  } catch (error) {
    console.error(
      'SAVE ALLOCATION ERROR:',
      error
    )

    alert(
      'Terjadi kesalahan saat menyimpan alokasi unit.'
    )

  } finally {
    setSaving(false)
  }
}
  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Truck className="h-5 w-5 text-gray-400" />
          Alokasi Unit
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Tentukan berapa unit yang berasal
          dari Internal, Vendor/VM, dan
          berapa unit yang belum tersedia.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Jenis Unit
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Kebutuhan
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Internal
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Vendor / VM
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tidak Tersedia
              </th>

              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {allocations.map(
              (allocation, index) => {
                const required =
                  getRequirementQuantity(
                    allocation.vehicle_type
                  )

                const total =
                  allocation.internal +
                  allocation.vendor +
                  allocation.unavailable

                const valid =
                  total === required

                return (
                  <tr
                    key={
                      allocation.vehicle_type
                    }
                  >
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {allocation.vehicle_type}
                    </td>

                    <td className="px-4 py-4 text-center font-semibold text-gray-900">
                      {required}
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={
                          allocation.internal
                        }
                        onChange={(event) =>
                          updateAllocation(
                            index,
                            'internal',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={
                          allocation.vendor
                        }
                        onChange={(event) =>
                          updateAllocation(
                            index,
                            'vendor',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min="0"
                        value={
                          allocation.unavailable
                        }
                        onChange={(event) =>
                          updateAllocation(
                            index,
                            'unavailable',
                            event.target.value
                          )
                        }
                        disabled={saving}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500"
                      />
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span
                        className={
                          valid
                            ? 'font-semibold text-emerald-600'
                            : 'font-semibold text-red-600'
                        }
                      >
                        {total} / {required}
                      </span>
                    </td>
                  </tr>
                )
              }
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
        <div className="font-medium text-gray-900">
          Contoh:
        </div>

        <div className="mt-1">
          Kebutuhan 15 Trailer → 10 Internal
          + 3 Vendor/VM + 2 Tidak Tersedia.
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Hanya unit Internal yang akan
          dikirim ke HSE. Unit Vendor/VM
          otomatis dicatat sebagai VM dan
          tidak masuk pemeriksaan HSE.
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={
            saving ||
            allocations.some(
              (allocation) =>
                !isValidAllocation(
                  allocation
                )
            )
          }
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          {saving
            ? 'Menyimpan...'
            : 'Simpan Alokasi'}
        </button>
      </div>
    </form>
  )
}