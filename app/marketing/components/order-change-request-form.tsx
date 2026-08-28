'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2 } from 'lucide-react'

type OrderChangeRequestFormProps = {
  orderId: string
  currentQuantity: number
}

type VehicleOption = {
  vehicle_type: string
  quantity: number
}

const ALL_VEHICLE_TYPES = [
  'Trailer',
  'Lowbed',
  'Tronton',
  'Fuso',
  'Colt Diesel',
  'Double Cabin',
  'Pickup',
  'Dolly',
]

const changeTypeOptions = [
  { value: 'reduce_unit', label: 'Kurangi Unit' },
  { value: 'add_unit', label: 'Tambah Unit' },
  { value: 'change_vehicle', label: 'Ganti Jenis Unit' },
  { value: 'change_trip', label: 'Ubah Trip' },
  { value: 'change_pk', label: 'Ubah PK' },
  { value: 'change_rft', label: 'Ubah RFT/TR/Job' },
  { value: 'change_customer', label: 'Ubah Customer' },
  { value: 'change_instruction', label: 'Ubah Instruksi' },
  { value: 'change_note', label: 'Ubah Catatan' },
  { value: 'cancel_order', label: 'Batalkan Order' },
]

export default function OrderChangeRequestForm({
  orderId,
  currentQuantity,
}: OrderChangeRequestFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([])

  const [changeType, setChangeType] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [currentVehicleType, setCurrentVehicleType] = useState('')

  const [quantity, setQuantity] = useState('')
  const [requestedValue, setRequestedValue] = useState('')

  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadVehicleOptions() {
      const { data, error } = await supabase
        .from('order_requirements')
        .select('vehicle_type, quantity')
        .eq('order_id', orderId)

      if (error) {
        console.error('LOAD VEHICLE OPTIONS ERROR:', error)
        setVehicleOptions([])
        return
      }

      setVehicleOptions(data || [])
    }

    loadVehicleOptions()
  }, [orderId])

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    if (!changeType) {
      alert('Jenis perubahan wajib dipilih.')
      return
    }

    if (
      (changeType === 'reduce_unit' ||
        changeType === 'add_unit' ||
        changeType === 'change_vehicle') &&
      !vehicleType
    ) {
      alert('Jenis kendaraan wajib dipilih.')
      return
    }

    const valueChangeTypes = [
      'change_trip',
      'change_pk',
      'change_rft',
      'change_customer',
      'change_instruction',
      'change_note',
    ]

    if (valueChangeTypes.includes(changeType) && !requestedValue.trim()) {
      alert('Nilai perubahan wajib diisi.')
      return
    }

    if (!reason.trim()) {
      alert('Alasan perubahan wajib diisi.')
      return
    }

    const requestedQuantity = quantity === '' ? null : Number(quantity)

    if (
      requestedQuantity !== null &&
      (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0)
    ) {
      alert('Jumlah perubahan tidak valid.')
      return
    }

    if (changeType === 'reduce_unit') {
      if (requestedQuantity === null) {
        alert('Jumlah unit wajib diisi.')
        return
      }

      const selectedVehicle = vehicleOptions.find(
        (item) => item.vehicle_type === vehicleType
      )

      const availableQuantity = selectedVehicle?.quantity || 0

      if (requestedQuantity > availableQuantity) {
        alert(
          `Jumlah ${vehicleType} yang dapat dikurangi maksimal ${availableQuantity} unit.`
        )
        return
      }
    }

    if (changeType === 'add_unit' && requestedQuantity === null) {
      alert('Jumlah unit wajib diisi.')
      return
    }

    if (changeType === 'change_vehicle') {
      if (!currentVehicleType) {
        alert('Jenis kendaraan saat ini wajib dipilih.')
        return
      }

      if (!vehicleType) {
        alert('Jenis kendaraan baru wajib dipilih.')
        return
      }

      if (requestedQuantity === null) {
        alert('Jumlah unit wajib diisi.')
        return
      }

      if (currentVehicleType === vehicleType) {
        alert(
          'Jenis kendaraan baru harus berbeda dari jenis kendaraan saat ini.'
        )
        return
      }

      const currentVehicle = vehicleOptions.find(
        (item) => item.vehicle_type === currentVehicleType
      )

      const availableQuantity = currentVehicle?.quantity || 0

      if (requestedQuantity > availableQuantity) {
        alert(
          `Jumlah ${currentVehicleType} yang dapat diganti maksimal ${availableQuantity} unit.`
        )
        return
      }
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

      const { data: request, error } = await supabase
        .from('order_change_requests')
        .insert({
          order_id: orderId,
          requested_by: user.id,
          change_type: changeType,
          reason: reason.trim(),
          requested_quantity: requestedQuantity,
          requested_vehicle_type: vehicleType || null,
          requested_value:
            changeType === 'change_vehicle'
              ? currentVehicleType
              : valueChangeTypes.includes(changeType)
              ? requestedValue.trim()
              : null,
          status: 'pending',
        })
        .select('id')
        .single()

      if (error || !request) {
        console.error('CREATE CHANGE REQUEST ERROR:', error)
        alert(error?.message || 'Request perubahan gagal dibuat.')
        return
      }

      const directChangeTypes = [
        'reduce_unit',
        'add_unit',
        'change_vehicle',
        'cancel_order',
      ]

      let autoApplied = false

      if (directChangeTypes.includes(changeType)) {
        const { data: applied, error: applyError } = await supabase.rpc(
          'apply_change_request_without_trucks',
          { p_request_id: request.id }
        )

        if (applyError) {
          console.error('AUTO APPLY CHANGE REQUEST ERROR:', applyError)
          alert(applyError.message)
          return
        }

        autoApplied = applied === true
      }

      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'CHANGE_REQUEST_CREATED',
          old_value: null,
          new_value: JSON.stringify({
            change_type: changeType,
            requested_quantity: requestedQuantity,
            requested_vehicle_type: vehicleType || null,
            current_vehicle_type:
              changeType === 'change_vehicle' ? currentVehicleType : null,
            requested_value:
              changeType === 'change_vehicle'
                ? currentVehicleType
                : valueChangeTypes.includes(changeType)
                ? requestedValue.trim()
                : null,
            reason: reason.trim(),
            auto_applied: autoApplied,
          }),
        })

      if (logError) {
        console.error('CHANGE REQUEST LOG ERROR:', logError)
      }

      if (autoApplied) {
        alert(
          'Perubahan berhasil diterapkan langsung karena belum ada detail truk.'
        )
      } else {
        alert('Permintaan perubahan berhasil dikirim ke Operational.')
      }

      setChangeType('')
      setVehicleType('')
      setCurrentVehicleType('')
      setQuantity('')
      setRequestedValue('')
      setReason('')

      router.refresh()
    } catch (error) {
      console.error('CHANGE REQUEST ERROR:', error)
      alert('Terjadi kesalahan saat mengirim permintaan perubahan.')
    } finally {
      setSaving(false)
    }
  }

  const needsVehicleType =
    changeType === 'reduce_unit' ||
    changeType === 'add_unit' ||
    changeType === 'change_vehicle'

  const selectedVehicle = vehicleOptions.find(
    (item) => item.vehicle_type === vehicleType
  )

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10'

  const labelClass =
    'mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5">
      <div>
        <label className={labelClass}>Jenis Perubahan</label>

        <select
          value={changeType}
          onChange={(event) => {
            setChangeType(event.target.value)
            setVehicleType('')
            setCurrentVehicleType('')
            setQuantity('')
            setRequestedValue('')
          }}
          disabled={saving}
          className={inputClass}
        >
          <option value="">Pilih perubahan</option>
          {changeTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {needsVehicleType && (
        <div className="space-y-4">
          {changeType === 'change_vehicle' && (
            <div>
              <label className={labelClass}>
                Jenis Kendaraan Saat Ini
              </label>

              <select
                value={currentVehicleType}
                onChange={(event) => {
                  setCurrentVehicleType(event.target.value)
                  setQuantity('')
                }}
                disabled={saving}
                className={inputClass}
              >
                <option value="">
                  Pilih kendaraan yang akan diganti
                </option>
                {vehicleOptions.map((item) => (
                  <option key={item.vehicle_type} value={item.vehicle_type}>
                    {item.vehicle_type} ({item.quantity} Unit)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>
              {changeType === 'change_vehicle'
                ? 'Jenis Kendaraan Baru'
                : 'Jenis Kendaraan'}
            </label>

            <select
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
              disabled={saving}
              className={inputClass}
            >
              <option value="">Pilih jenis kendaraan</option>
              {(changeType === 'reduce_unit'
                ? vehicleOptions.map((item) => item.vehicle_type)
                : ALL_VEHICLE_TYPES
              )
                .filter((type, index, list) => list.indexOf(type) === index)
                .filter((type) => type !== currentVehicleType)
                .map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
            </select>

            {changeType === 'reduce_unit' && vehicleType && (
              <p className="mt-1.5 text-xs text-gray-500">
                Tersedia{' '}
                <strong className="text-gray-700">
                  {selectedVehicle?.quantity || 0}
                </strong>{' '}
                unit {vehicleType}.
              </p>
            )}

            {changeType === 'change_vehicle' && currentVehicleType && (
              <p className="mt-1.5 text-xs text-gray-500">
                Yang akan diganti:{' '}
                <strong className="text-gray-700">
                  {currentVehicleType}
                </strong>
              </p>
            )}
          </div>
        </div>
      )}

      {(changeType === 'reduce_unit' ||
        changeType === 'add_unit' ||
        changeType === 'change_vehicle') && (
        <div>
          <label className={labelClass}>Jumlah Unit</label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={saving}
            placeholder="Contoh: 2"
            className={inputClass}
          />

          {changeType === 'reduce_unit' && vehicleType && (
            <p className="mt-1.5 text-xs text-gray-500">
              Maksimal pengurangan:{' '}
              <strong className="text-gray-700">
                {selectedVehicle?.quantity || 0}
              </strong>{' '}
              unit.
            </p>
          )}

          {changeType === 'change_vehicle' && currentVehicleType && (
            <p className="mt-1.5 text-xs text-gray-500">
              Maksimal penggantian:{' '}
              <strong className="text-gray-700">
                {vehicleOptions.find(
                  (item) => item.vehicle_type === currentVehicleType
                )?.quantity || 0}
              </strong>{' '}
              unit.
            </p>
          )}

          {changeType !== 'reduce_unit' &&
            changeType !== 'change_vehicle' && (
              <p className="mt-1.5 text-xs text-gray-500">
                Jumlah unit saat ini: {currentQuantity}
              </p>
            )}
        </div>
      )}

      {[
        'change_trip',
        'change_pk',
        'change_rft',
        'change_customer',
        'change_instruction',
        'change_note',
      ].includes(changeType) && (
        <div>
          <label className={labelClass}>
            {changeType === 'change_trip'
              ? 'Trip Baru'
              : changeType === 'change_pk'
              ? 'PK Baru'
              : changeType === 'change_rft'
              ? 'RFT/TR/Job Baru'
              : changeType === 'change_customer'
              ? 'Customer Baru'
              : changeType === 'change_instruction'
              ? 'Instruksi Baru'
              : 'Catatan Baru'}
          </label>

          <textarea
            value={requestedValue}
            onChange={(event) => setRequestedValue(event.target.value)}
            disabled={saving}
            rows={
              changeType === 'change_instruction' ||
              changeType === 'change_note'
                ? 5
                : 3
            }
            placeholder={
              changeType === 'change_trip'
                ? 'Contoh: Simpang Gas - Rebonjaro - Sambar'
                : changeType === 'change_pk'
                ? 'Masukkan PK baru'
                : changeType === 'change_rft'
                ? 'Masukkan RFT/TR/Job baru'
                : changeType === 'change_customer'
                ? 'Masukkan nama customer baru'
                : changeType === 'change_instruction'
                ? 'Masukkan instruksi baru'
                : 'Masukkan catatan baru'
            }
            className={`resize-none ${inputClass}`}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Alasan Perubahan</label>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
          rows={4}
          placeholder={
            changeType === 'reduce_unit'
              ? 'Contoh: Customer mengurangi kebutuhan Trailer.'
              : changeType === 'add_unit'
              ? 'Contoh: Customer menambah kebutuhan Tronton.'
              : changeType === 'change_vehicle'
              ? 'Contoh: Customer meminta Trailer diganti menjadi Tronton.'
              : 'Contoh: Jelaskan alasan perubahan.'
          }
          className={`resize-none ${inputClass}`}
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Catatan:</strong> Jika belum ada detail truk, perubahan unit
        akan diterapkan langsung. Jika detail truk sudah ada, permintaan
        akan diproses oleh Operational.
      </div>

      <button
        type="submit"
        disabled={
          saving ||
          !changeType ||
          !reason.trim() ||
          ([
            'change_trip',
            'change_pk',
            'change_rft',
            'change_customer',
            'change_instruction',
            'change_note',
          ].includes(changeType) &&
            !requestedValue.trim()) ||
          (needsVehicleType && !vehicleType) ||
          (changeType === 'change_vehicle' && !currentVehicleType)
        }
        className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {saving ? 'Mengirim...' : 'Ajukan Perubahan'}
      </button>
    </form>
  )
}