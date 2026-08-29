'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { MinusCircle, Loader2, CheckCircle2 } from 'lucide-react'

type Truck = {
  id: string
  vehicle_type: string
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  status: string | null
}

type ReduceUnitFormProps = {
  orderId: string
  requestedVehicleType: string
  requestedQuantity: number
  note: string | null
  trucks: Truck[]
  requirementQuantity: number
  currentOrderQuantity: number
}

export default function ReduceUnitForm({
  orderId,
  requestedVehicleType,
  requestedQuantity,
  note,
  trucks,
  requirementQuantity,
  currentOrderQuantity,
}: ReduceUnitFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const selectableTrucks = trucks.filter(
    (truck) =>
      truck.vehicle_type.toLowerCase() ===
        requestedVehicleType.toLowerCase() &&
      truck.status !== 'departed' &&
      truck.status !== 'cancelled'
  )

  function toggleTruck(truckId: string) {
    setSelectedTruckIds((current) => {
      if (current.includes(truckId)) {
        return current.filter((id) => id !== truckId)
      }

      if (current.length >= requestedQuantity) {
        toast.warning(
          'Batas Maksimal',
          `Maksimal ${requestedQuantity} unit yang boleh dipilih.`
        )
        return current
      }

      return [...current, truckId]
    })
  }

  async function handleConfirm() {
    if (saving) return

    if (selectedTruckIds.length !== requestedQuantity) {
      toast.error(
        'Pilihan Belum Lengkap',
        `Pilih tepat ${requestedQuantity} unit terlebih dahulu.`
      )
      return
    }

    if (requestedQuantity > requirementQuantity) {
      toast.error(
        'Jumlah Tidak Valid',
        `Jumlah pengurangan melebihi kebutuhan ${requestedVehicleType}.`
      )
      return
    }

    if (requestedQuantity > currentOrderQuantity) {
      toast.error(
        'Jumlah Tidak Valid',
        'Jumlah pengurangan melebihi total unit order.'
      )
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
        return
      }

      const { data: currentTrucks, error: truckFetchError } = await supabase
        .from('order_trucks')
        .select(`
          id,
          vehicle_type,
          status,
          plate_number,
          driver_name,
          no_buntut
        `)
        .in('id', selectedTruckIds)

      if (truckFetchError) {
        toast.error('Gagal Memuat Data Unit', truckFetchError.message)
        return
      }

      if (!currentTrucks || currentTrucks.length !== requestedQuantity) {
        toast.error(
          'Data Berubah',
          'Data unit berubah. Silakan refresh halaman dan pilih ulang unit.'
        )
        return
      }

      const invalidTruck = currentTrucks.some(
        (truck) =>
          truck.vehicle_type.toLowerCase() !==
            requestedVehicleType.toLowerCase() ||
          truck.status === 'departed' ||
          truck.status === 'cancelled'
      )

      if (invalidTruck) {
        toast.error(
          'Unit Tidak Tersedia',
          'Salah satu unit sudah tidak dapat dibatalkan. Silakan pilih ulang.'
        )
        return
      }

      const oldValue = {
        vehicle_type: requestedVehicleType,
        requested_quantity: requestedQuantity,
        selected_units: currentTrucks.map((truck) => ({
          truck_id: truck.id,
          plate_number: truck.plate_number,
          driver_name: truck.driver_name,
          status: truck.status,
        })),
        order_quantity: currentOrderQuantity,
        requirement_quantity: requirementQuantity,
      }

      const { error: updateTruckError } = await supabase
        .from('order_trucks')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedTruckIds)

      if (updateTruckError) {
        console.error('CANCEL TRUCK ERROR:', updateTruckError)
        toast.error('Gagal Membatalkan Unit', updateTruckError.message)
        return
      }

      const newRequirementQuantity =
        requirementQuantity - requestedQuantity

      const { error: requirementError } = await supabase
        .from('order_requirements')
        .update({ quantity: newRequirementQuantity })
        .eq('order_id', orderId)
        .eq('vehicle_type', requestedVehicleType)

      if (requirementError) {
        console.error('UPDATE REQUIREMENT ERROR:', requirementError)

        for (const truck of currentTrucks) {
          await supabase
            .from('order_trucks')
            .update({
              status: truck.status || 'waiting_hse',
              updated_at: new Date().toISOString(),
            })
            .eq('id', truck.id)
        }

        toast.error('Gagal Memperbarui Kebutuhan', requirementError.message)
        return
      }

      const newOrderQuantity = currentOrderQuantity - requestedQuantity

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          quantity: newOrderQuantity,
          reduce_unit_requested: false,
          reduce_unit_quantity: null,
          reduce_unit_vehicle_type: null,
          reduce_unit_note: null,
          reduce_unit_requested_by: null,
          reduce_unit_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (orderError) {
        console.error('UPDATE ORDER ERROR:', orderError)
        toast.error('Gagal Memperbarui Order', orderError.message)
        return
      }

      const newValue = {
        action: 'REDUCE_UNIT',
        vehicle_type: requestedVehicleType,
        reduced_quantity: requestedQuantity,
        cancelled_units: currentTrucks.map((truck) => ({
          truck_id: truck.id,
          plate_number: truck.plate_number,
          driver_name: truck.driver_name,
        })),
        order_quantity: newOrderQuantity,
        requirement_quantity: newRequirementQuantity,
        reason: note,
        processed_by: user.id,
      }

      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'REDUCE_UNIT',
          old_value: JSON.stringify(oldValue),
          new_value: JSON.stringify(newValue),
          truck_id:
            currentTrucks.length === 1 ? currentTrucks[0].id : null,
        })

      if (logError) {
        console.error('REDUCE ACTIVITY LOG ERROR:', logError)
        toast.warning(
          'Pengurangan Berhasil, Log Gagal',
          `Pengurangan berhasil diproses, tetapi activity log gagal disimpan: ${logError.message}`
        )
        router.refresh()
        return
      }

      toast.success(
        'Pengurangan Berhasil',
        `Berhasil mengurangi ${requestedQuantity} ${requestedVehicleType}.`
      )

      router.refresh()
    } catch (error) {
      console.error('REDUCE UNIT ERROR:', error)
      toast.error(
        'Terjadi Kesalahan',
        'Gagal memproses pengurangan unit. Silakan coba lagi.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
      <div className="border-b border-orange-100 bg-orange-50/60 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-orange-900">
          <MinusCircle className="h-5 w-5 text-orange-600" />
          Request Pengurangan Unit
        </h2>
        <p className="mt-1 text-sm text-orange-800/80">
          Marketing meminta pengurangan unit. Operational menentukan unit
          mana yang tidak jadi jalan.
        </p>
      </div>

      <div className="p-6">
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Jenis Unit
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {requestedVehicleType}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Diminta Dikurangi
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {requestedQuantity} Unit
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Alasan
              </p>
              <p className="mt-1.5 font-bold text-gray-900">
                {note || '-'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                Pilih Unit yang Tidak Jadi Jalan
              </h3>
              <p className="text-xs text-gray-500">
                Pilih {requestedQuantity} unit. Unit yang sudah jalan tidak
                dapat dipilih.
              </p>
            </div>

            <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
              {selectedTruckIds.length}/{requestedQuantity}
            </span>
          </div>

          <div className="space-y-3">
            {selectableTrucks.map((truck) => {
              const selected = selectedTruckIds.includes(truck.id)

              return (
                <button
                  key={truck.id}
                  type="button"
                  onClick={() => toggleTruck(truck.id)}
                  disabled={saving}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selected
                      ? 'border-[#01236A]/40 bg-[#01236A]/5 ring-1 ring-inset ring-[#01236A]/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">
                        {truck.vehicle_type}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {truck.plate_number || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        Driver: {truck.driver_name || '-'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`mb-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          selected
                            ? 'bg-[#01236A] text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {selected && <CheckCircle2 className="h-3 w-3" />}
                        {selected ? 'Dipilih' : truck.status || '-'}
                      </div>

                      {truck.no_buntut && (
                        <div className="text-xs text-gray-400">
                          Buntut: {truck.no_buntut}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {!selectableTrucks.length && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
              Tidak ada unit {requestedVehicleType} yang dapat dipilih.
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-orange-100 pt-5">
          <p className="text-xs text-orange-800">
            Unit yang dipilih akan ditandai{' '}
            <strong>tidak jadi jalan</strong>.
          </p>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || selectedTruckIds.length !== requestedQuantity}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MinusCircle className="h-4 w-4" />
            )}
            {saving ? 'Memproses...' : 'Konfirmasi Pengurangan'}
          </button>
        </div>
      </div>
    </div>
  )
}