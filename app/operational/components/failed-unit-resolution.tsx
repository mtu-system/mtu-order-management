'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  RefreshCw,
  Ban,
  Building2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { logOrderHistory, logUnitHistory } from '@/lib/history'

type FailedUnitResolutionProps = {
  truck: {
    id: string
    order_id: string
    vehicle_type: string
    plate_number: string | null
    driver_name: string | null
    driver_phone: string | null
  }
}

type Mode = null | 'replace'

export default function FailedUnitResolution({
  truck,
}: FailedUnitResolutionProps) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>(null)
  const [plateNumber, setPlateNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleReplace() {
    if (saving) return

    if (!plateNumber.trim() || !driverName.trim() || !driverPhone.trim()) {
      alert('Plat nomor, nama driver, dan No. HP wajib diisi.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase
        .from('order_trucks')
        .update({
          plate_number: plateNumber.trim(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          status: 'waiting_hse',
          updated_at: new Date().toISOString(),
        })
        .eq('id', truck.id)
        .eq('status', 'failed')

      if (error) {
        console.error('REPLACE FAILED UNIT ERROR:', error)
        alert(error.message)
        return
      }

      await supabase.from('activity_logs').insert({
        order_id: truck.order_id,
        user_id: user.id,
        action: 'REPLACE_FAILED_UNIT',
        old_value: JSON.stringify({
          plate_number: truck.plate_number,
          driver_name: truck.driver_name,
          driver_phone: truck.driver_phone,
        }),
        new_value: JSON.stringify({
          plate_number: plateNumber.trim(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
        }),
        truck_id: truck.id,
      })

      await logUnitHistory({
        truckId: truck.id,
        orderId: truck.order_id,
        action: 'replace_failed_unit',
        fieldName: 'plate_number',
        oldValue: `${truck.plate_number || '-'} · ${truck.driver_name || '-'}`,
        newValue: `${plateNumber.trim()} · ${driverName.trim()}`,
        reason: 'Unit Failed HSE - detail truk diganti oleh Operational',
        changedBy: user.id,
      })

      alert('Detail truk berhasil diganti. Unit dikirim ulang ke HSE.')

      router.refresh()
    } catch (error) {
      console.error('REPLACE FAILED UNIT ERROR:', error)
      alert('Terjadi kesalahan saat mengganti detail truk.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUseVendor() {
    if (saving) return

    const confirmed = window.confirm(
      `Ganti unit ${truck.vehicle_type} ini menjadi Vendor / VM? Unit tidak akan masuk pemeriksaan HSE.`
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase
        .from('order_trucks')
        .update({
          source: 'vendor',
          status: 'vm',
          vendor_name: 'Vendor / VM',
          plate_number: null,
          driver_name: null,
          driver_phone: null,
          no_buntut: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', truck.id)
        .eq('status', 'failed')

      if (error) {
        console.error('USE VENDOR FOR FAILED UNIT ERROR:', error)
        alert(error.message)
        return
      }

      await supabase.from('activity_logs').insert({
        order_id: truck.order_id,
        user_id: user.id,
        action: 'FAILED_UNIT_TO_VENDOR',
        old_value: JSON.stringify({
          vehicle_type: truck.vehicle_type,
          plate_number: truck.plate_number,
          driver_name: truck.driver_name,
        }),
        new_value: JSON.stringify({ source: 'vendor', status: 'vm' }),
        truck_id: truck.id,
      })

      await logUnitHistory({
        truckId: truck.id,
        orderId: truck.order_id,
        action: 'failed_unit_to_vendor',
        fieldName: 'source',
        oldValue: `Internal (Failed) · ${truck.plate_number || '-'}`,
        newValue: 'Vendor / VM',
        reason: 'Unit Failed HSE - dialihkan ke Vendor oleh Operational',
        changedBy: user.id,
      })

      alert('Unit berhasil diganti menjadi Vendor / VM.')

      router.refresh()
    } catch (error) {
      console.error('USE VENDOR FOR FAILED UNIT ERROR:', error)
      alert('Terjadi kesalahan saat mengganti unit ke Vendor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (saving) return

    const confirmed = window.confirm(
      `Batalkan unit ${truck.vehicle_type} ini? Kebutuhan kendaraan akan dikurangi 1.`
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error: truckError } = await supabase
        .from('order_trucks')
        .update({
          status: 'cancelled',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
          cancel_reason: 'Unit Failed HSE - dibatalkan Operational',
        })
        .eq('id', truck.id)
        .eq('status', 'failed')

      if (truckError) {
        console.error('CANCEL FAILED UNIT ERROR:', truckError)
        alert(truckError.message)
        return
      }

      const { data: requirement, error: requirementFetchError } =
        await supabase
          .from('order_requirements')
          .select('id, quantity')
          .eq('order_id', truck.order_id)
          .eq('vehicle_type', truck.vehicle_type)
          .maybeSingle()

      if (requirementFetchError) {
        console.error('FETCH REQUIREMENT ERROR:', requirementFetchError)
      }

      if (requirement) {
        const newQuantity = Math.max(0, requirement.quantity - 1)

        const { error: requirementUpdateError } = await supabase
          .from('order_requirements')
          .update({ quantity: newQuantity })
          .eq('id', requirement.id)

        if (requirementUpdateError) {
          console.error(
            'UPDATE REQUIREMENT ERROR:',
            requirementUpdateError
          )
        }
      }

      const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', truck.order_id)
        .single()

      let newOrderQuantity: number | null = null

      if (!orderFetchError && orderData) {
        newOrderQuantity = Math.max(0, orderData.quantity - 1)

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ quantity: newOrderQuantity })
          .eq('id', truck.order_id)

        if (orderUpdateError) {
          console.error('UPDATE ORDER QUANTITY ERROR:', orderUpdateError)
        }
      }

      await supabase.from('activity_logs').insert({
        order_id: truck.order_id,
        user_id: user.id,
        action: 'CANCEL_FAILED_UNIT',
        old_value: JSON.stringify({
          vehicle_type: truck.vehicle_type,
          plate_number: truck.plate_number,
        }),
        new_value: 'cancelled',
        truck_id: truck.id,
      })

      await logUnitHistory({
        truckId: truck.id,
        orderId: truck.order_id,
        action: 'cancel_failed_unit',
        fieldName: 'status',
        oldValue: `Failed · ${truck.vehicle_type} · ${truck.plate_number || '-'}`,
        newValue: 'Cancelled',
        reason: 'Unit Failed HSE - dibatalkan oleh Operational',
        changedBy: user.id,
      })

      if (orderData && newOrderQuantity !== null) {
        await logOrderHistory({
          orderId: truck.order_id,
          action: 'cancel_failed_unit',
          fieldName: 'quantity',
          oldValue: String(orderData.quantity),
          newValue: String(newOrderQuantity),
          reason: 'Unit Failed HSE - dibatalkan, kebutuhan dikurangi 1',
          changedBy: user.id,
        })
      }

      alert('Unit berhasil dibatalkan.')

      router.refresh()
    } catch (error) {
      console.error('CANCEL FAILED UNIT ERROR:', error)
      alert('Terjadi kesalahan saat membatalkan unit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">{truck.vehicle_type}</p>
          <p className="text-sm text-gray-600">
            {truck.plate_number || '-'}
            {' · '}
            {truck.driver_name || '-'}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </span>
      </div>

      {mode !== 'replace' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => setMode('replace')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#01236A]/20 bg-white px-3 py-2 text-xs font-bold text-[#01236A] transition hover:bg-[#01236A]/5 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Ganti Detail Truk
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleUseVendor}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Building2 className="h-3.5 w-3.5" />
            )}
            Pakai Vendor
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleCancel}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
            Batalkan
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[#01236A]/20 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-gray-900">
            Detail Truk Pengganti
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={plateNumber}
              onChange={(event) => setPlateNumber(event.target.value)}
              placeholder="Plat Nomor"
              disabled={saving}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
            <input
              type="text"
              value={driverName}
              onChange={(event) => setDriverName(event.target.value)}
              placeholder="Nama Driver"
              disabled={saving}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
            <input
              type="text"
              value={driverPhone}
              onChange={(event) => setDriverPhone(event.target.value)}
              placeholder="No. HP Driver"
              disabled={saving}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setMode(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleReplace}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#01236A]/85 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Simpan & Kirim ke HSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}