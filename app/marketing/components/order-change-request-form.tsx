'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function OrderChangeRequestForm({
  orderId,
  currentQuantity,
}: OrderChangeRequestFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [vehicleOptions, setVehicleOptions] = useState<
    VehicleOption[]
  >([])

  const [changeType, setChangeType] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [currentVehicleType, setCurrentVehicleType] =
    useState('')

  const [quantity, setQuantity] = useState('')
  const [requestedValue, setRequestedValue] =
    useState('')

  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadVehicleOptions() {
      const { data, error } = await supabase
        .from('order_requirements')
        .select('vehicle_type, quantity')
        .eq('order_id', orderId)

      if (error) {
        console.error(
          'LOAD VEHICLE OPTIONS ERROR:',
          error
        )

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

    // ==========================================
    // VALIDASI JENIS PERUBAHAN
    // ==========================================

    if (!changeType) {
      alert('Jenis perubahan wajib dipilih.')
      return
    }

    // ==========================================
    // JENIS UNIT WAJIB UNTUK:
    // - reduce_unit
    // - add_unit
    // - change_vehicle
    // ==========================================

    if (
      (
        changeType === 'reduce_unit' ||
        changeType === 'add_unit' ||
        changeType === 'change_vehicle'
      ) &&
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

    if (
      valueChangeTypes.includes(changeType) &&
      !requestedValue.trim()
    ) {
      alert('Nilai perubahan wajib diisi.')
      return
    }

    // ==========================================
    // VALIDASI ALASAN
    // ==========================================

    if (!reason.trim()) {
      alert('Alasan perubahan wajib diisi.')
      return
    }

    // ==========================================
    // REQUESTED QUANTITY
    // ==========================================

    const requestedQuantity =
      quantity === ''
        ? null
        : Number(quantity)

    // ==========================================
    // VALIDASI JUMLAH
    // ==========================================

    if (
      requestedQuantity !== null &&
      (
        !Number.isInteger(
          requestedQuantity
        ) ||
        requestedQuantity <= 0
      )
    ) {
      alert('Jumlah perubahan tidak valid.')
      return
    }

    // ==========================================
    // REDUCE UNIT
    // ==========================================

    if (
      changeType === 'reduce_unit'
    ) {
      if (requestedQuantity === null) {
        alert('Jumlah unit wajib diisi.')
        return
      }

      const selectedVehicle =
        vehicleOptions.find(
          (item) =>
            item.vehicle_type === vehicleType
        )

      const availableQuantity =
        selectedVehicle?.quantity || 0

      if (
        requestedQuantity >
        availableQuantity
      ) {
        alert(
          `Jumlah ${vehicleType} yang dapat dikurangi maksimal ${availableQuantity} unit.`
        )

        return
      }
    }

    // ==========================================
    // ADD UNIT
    // ==========================================

    if (
      changeType === 'add_unit' &&
      requestedQuantity === null
    ) {
      alert('Jumlah unit wajib diisi.')
      return
    }

    // ==========================================
    // CHANGE VEHICLE
    // ==========================================

    if (
      changeType === 'change_vehicle'
    ) {
      if (!currentVehicleType) {
        alert(
          'Jenis kendaraan saat ini wajib dipilih.'
        )

        return
      }

      if (!vehicleType) {
        alert(
          'Jenis kendaraan baru wajib dipilih.'
        )

        return
      }

      if (requestedQuantity === null) {
        alert('Jumlah unit wajib diisi.')
        return
      }

      if (
        currentVehicleType ===
        vehicleType
      ) {
        alert(
          'Jenis kendaraan baru harus berbeda dari jenis kendaraan saat ini.'
        )

        return
      }

      const currentVehicle =
        vehicleOptions.find(
          (item) =>
            item.vehicle_type ===
            currentVehicleType
        )

      const availableQuantity =
        currentVehicle?.quantity || 0

      if (
        requestedQuantity >
        availableQuantity
      ) {
        alert(
          `Jumlah ${currentVehicleType} yang dapat diganti maksimal ${availableQuantity} unit.`
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
        alert(
          'Session login tidak ditemukan.'
        )

        return
      }

      // ==========================================
      // CREATE CHANGE REQUEST
      // ==========================================

      const {
        data: request,
        error,
      } = await supabase
        .from('order_change_requests')
        .insert({
          order_id: orderId,
          requested_by: user.id,
          change_type: changeType,
          reason: reason.trim(),

          requested_quantity:
            requestedQuantity,

          requested_vehicle_type:
            vehicleType || null,

          // Untuk change_vehicle:
          // requested_value = kendaraan lama
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
        console.error(
          'CREATE CHANGE REQUEST ERROR:',
          error
        )

        alert(
          error?.message ||
          'Request perubahan gagal dibuat.'
        )

        return
      }

      // ==========================================
      // AUTO APPLY JIKA BELUM ADA DETAIL TRUK
      // ==========================================

      const directChangeTypes = [
        'reduce_unit',
        'add_unit',
        'change_vehicle',
        'cancel_order',
      ]

      let autoApplied = false

      if (
        directChangeTypes.includes(
          changeType
        )
      ) {
        const {
          data: applied,
          error: applyError,
        } = await supabase.rpc(
          'apply_change_request_without_trucks',
          {
            p_request_id: request.id,
          }
        )

        if (applyError) {
          console.error(
            'AUTO APPLY CHANGE REQUEST ERROR:',
            applyError
          )

          alert(applyError.message)

          return
        }

        autoApplied =
          applied === true
      }

      // ==========================================
      // ACTIVITY LOG
      // ==========================================

      const {
        error: logError,
      } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,

          action:
            'CHANGE_REQUEST_CREATED',

          old_value: null,

          new_value:
            JSON.stringify({
              change_type:
                changeType,

              requested_quantity:
                requestedQuantity,

              requested_vehicle_type:
                vehicleType || null,

              current_vehicle_type:
                changeType ===
                'change_vehicle'
                  ? currentVehicleType
                  : null,

              requested_value:
                changeType ===
                'change_vehicle'
                  ? currentVehicleType
                  : valueChangeTypes.includes(
                      changeType
                    )
                    ? requestedValue.trim()
                    : null,

              reason:
                reason.trim(),

              auto_applied:
                autoApplied,
            }),
        })

      if (logError) {
        console.error(
          'CHANGE REQUEST LOG ERROR:',
          logError
        )
      }

      // ==========================================
      // HASIL
      // ==========================================

      if (autoApplied) {
        alert(
          'Perubahan berhasil diterapkan langsung karena belum ada detail truk.'
        )
      } else {
        alert(
          'Permintaan perubahan berhasil dikirim ke Operational.'
        )
      }

      // ==========================================
      // RESET FORM
      // ==========================================

      setChangeType('')
      setVehicleType('')
      setCurrentVehicleType('')
      setQuantity('')
      setRequestedValue('')
      setReason('')

      router.refresh()
    } catch (error) {
      console.error(
        'CHANGE REQUEST ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat mengirim permintaan perubahan.'
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // APAKAH PERLU PILIH JENIS UNIT?
  // ==========================================

  const needsVehicleType =
    changeType === 'reduce_unit' ||
    changeType === 'add_unit' ||
    changeType === 'change_vehicle'

  // ==========================================
  // UNIT TERSEDIA UNTUK JENIS YANG DIPILIH
  // ==========================================

  const selectedVehicle =
    vehicleOptions.find(
      (item) =>
        item.vehicle_type ===
        vehicleType
    )

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 space-y-5"
    >

      {/* ==========================================
          JENIS PERUBAHAN
      ========================================== */}

      <div>
        <label className="mb-2 block text-sm font-medium">
          Jenis Perubahan
        </label>

        <select
          value={changeType}
          onChange={(event) => {
            setChangeType(
              event.target.value
            )

            setVehicleType('')
            setCurrentVehicleType('')
            setQuantity('')
            setRequestedValue('')
          }}
          disabled={saving}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >

          <option value="">
            Pilih perubahan
          </option>

          <option value="reduce_unit">
            Kurangi Unit
          </option>

          <option value="add_unit">
            Tambah Unit
          </option>

          <option value="change_vehicle">
            Ganti Jenis Unit
          </option>

          <option value="change_trip">
            Ubah Trip
          </option>

          <option value="change_pk">
            Ubah PK
          </option>

          <option value="change_rft">
            Ubah RFT/TR/Job
          </option>

          <option value="change_customer">
            Ubah Customer
          </option>

          <option value="change_instruction">
            Ubah Instruksi
          </option>

          <option value="change_note">
            Ubah Catatan
          </option>

          <option value="cancel_order">
            Batalkan Order
          </option>

        </select>
      </div>


      {/* ==========================================
          JENIS KENDARAAN
      ========================================== */}

      {needsVehicleType && (
        <div className="space-y-4">

          {/* ==========================================
              KENDARAAN SAAT INI
          ========================================== */}

          {changeType ===
            'change_vehicle' && (
            <div>

              <label className="mb-2 block text-sm font-medium">
                Jenis Kendaraan Saat Ini
              </label>

              <select
                value={
                  currentVehicleType
                }
                onChange={(event) => {
                  setCurrentVehicleType(
                    event.target.value
                  )

                  setQuantity('')
                }}
                disabled={saving}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >

                <option value="">
                  Pilih kendaraan yang akan diganti
                </option>

                {vehicleOptions.map(
                  (item) => (
                    <option
                      key={
                        item.vehicle_type
                      }
                      value={
                        item.vehicle_type
                      }
                    >
                      {
                        item.vehicle_type
                      }{' '}
                      (
                      {
                        item.quantity
                      }{' '}
                      Unit)
                    </option>
                  )
                )}

              </select>

            </div>
          )}


          {/* ==========================================
              KENDARAAN BARU / JENIS UNIT
          ========================================== */}

          <div>

            <label className="mb-2 block text-sm font-medium">
              {changeType ===
              'change_vehicle'
                ? 'Jenis Kendaraan Baru'
                : 'Jenis Kendaraan'}
            </label>

            <select
              value={vehicleType}
              onChange={(event) =>
                setVehicleType(
                  event.target.value
                )
              }
              disabled={saving}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >

              <option value="">
                Pilih jenis kendaraan
              </option>

              {(
                changeType ===
                'reduce_unit'
                  ? vehicleOptions.map(
                      (item) =>
                        item.vehicle_type
                    )
                  : ALL_VEHICLE_TYPES
              )
                .filter(
                  (
                    type,
                    index,
                    list
                  ) =>
                    list.indexOf(
                      type
                    ) === index
                )
                .filter(
                  (type) =>
                    type !==
                    currentVehicleType
                )
                .map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}

            </select>


            {/* INFO UNIT AVAILABLE */}

            {changeType ===
              'reduce_unit' &&
              vehicleType && (
                <p className="mt-1 text-xs text-gray-500">
                  Tersedia{' '}
                  <strong>
                    {
                      selectedVehicle
                        ?.quantity || 0
                    }
                  </strong>{' '}
                  unit{' '}
                  {vehicleType}.
                </p>
              )}


            {/* INFO KENDARAAN LAMA */}

            {changeType ===
              'change_vehicle' &&
              currentVehicleType && (
                <p className="mt-1 text-xs text-gray-500">
                  Yang akan diganti:{' '}
                  <strong>
                    {
                      currentVehicleType
                    }
                  </strong>
                </p>
              )}

          </div>

        </div>
      )}


      {/* ==========================================
          JUMLAH UNIT
      ========================================== */}

      {(
        changeType ===
          'reduce_unit' ||
        changeType ===
          'add_unit' ||
        changeType ===
          'change_vehicle'
      ) && (

        <div>

          <label className="mb-2 block text-sm font-medium">
            Jumlah Unit
          </label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) =>
              setQuantity(
                event.target.value
              )
            }
            disabled={saving}
            placeholder="Contoh: 2"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />


          {/* MAX REDUCE */}

          {changeType ===
            'reduce_unit' &&
            vehicleType && (
              <p className="mt-1 text-xs text-gray-500">
                Maksimal pengurangan:{' '}
                <strong>
                  {
                    selectedVehicle
                      ?.quantity || 0
                  }
                </strong>{' '}
                unit.
              </p>
            )}


          {/* MAX CHANGE VEHICLE */}

          {changeType ===
            'change_vehicle' &&
            currentVehicleType && (
              <p className="mt-1 text-xs text-gray-500">
                Maksimal penggantian:{' '}
                <strong>
                  {
                    vehicleOptions.find(
                      (item) =>
                        item.vehicle_type ===
                        currentVehicleType
                    )?.quantity || 0
                  }
                </strong>{' '}
                unit.
              </p>
            )}


          {/* CURRENT TOTAL */}

          {changeType !==
            'reduce_unit' &&
            changeType !==
              'change_vehicle' && (
              <p className="mt-1 text-xs text-gray-500">
                Jumlah unit saat ini:{' '}
                {currentQuantity}
              </p>
            )}

        </div>
      )}


      {/* ==========================================
          NILAI PERUBAHAN
      ========================================== */}

      {[
        'change_trip',
        'change_pk',
        'change_rft',
        'change_customer',
        'change_instruction',
        'change_note',
      ].includes(changeType) && (

        <div>

          <label className="mb-2 block text-sm font-medium">

            {changeType ===
              'change_trip'
              ? 'Trip Baru'
              : changeType ===
                  'change_pk'
                ? 'PK Baru'
                : changeType ===
                    'change_rft'
                  ? 'RFT/TR/Job Baru'
                  : changeType ===
                      'change_customer'
                    ? 'Customer Baru'
                    : changeType ===
                        'change_instruction'
                      ? 'Instruksi Baru'
                      : 'Catatan Baru'}

          </label>

          <textarea
            value={requestedValue}
            onChange={(event) =>
              setRequestedValue(
                event.target.value
              )
            }
            disabled={saving}
            rows={
              changeType ===
                'change_instruction' ||
              changeType ===
                'change_note'
                ? 5
                : 3
            }
            placeholder={
              changeType ===
              'change_trip'
                ? 'Contoh: Simpang Gas - Rebonjaro - Sambar'
                : changeType ===
                    'change_pk'
                  ? 'Masukkan PK baru'
                  : changeType ===
                      'change_rft'
                    ? 'Masukkan RFT/TR/Job baru'
                    : changeType ===
                        'change_customer'
                      ? 'Masukkan nama customer baru'
                      : changeType ===
                          'change_instruction'
                        ? 'Masukkan instruksi baru'
                        : 'Masukkan catatan baru'
            }
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />

        </div>
      )}


      {/* ==========================================
          ALASAN
      ========================================== */}

      <div>

        <label className="mb-2 block text-sm font-medium">
          Alasan Perubahan
        </label>

        <textarea
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value
            )
          }
          disabled={saving}
          rows={4}
          placeholder={
            changeType ===
              'reduce_unit'
              ? 'Contoh: Customer mengurangi kebutuhan Trailer.'
              : changeType ===
                  'add_unit'
                ? 'Contoh: Customer menambah kebutuhan Tronton.'
                : changeType ===
                    'change_vehicle'
                  ? 'Contoh: Customer meminta Trailer diganti menjadi Tronton.'
                  : 'Contoh: Jelaskan alasan perubahan.'
          }
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />

      </div>


      {/* ==========================================
          CATATAN
      ========================================== */}

      <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">

        <strong>
          Catatan:
        </strong>{' '}

        Jika belum ada detail truk, perubahan unit akan
        diterapkan langsung. Jika detail truk sudah ada,
        permintaan akan diproses oleh Operational.

      </div>


      {/* ==========================================
          SUBMIT
      ========================================== */}

      <button
        type="submit"
        disabled={
          saving ||
          !changeType ||
          !reason.trim() ||

          (
            [
              'change_trip',
              'change_pk',
              'change_rft',
              'change_customer',
              'change_instruction',
              'change_note',
            ].includes(changeType) &&
            !requestedValue.trim()
          ) ||

          (
            needsVehicleType &&
            !vehicleType
          ) ||

          (
            changeType ===
              'change_vehicle' &&
            !currentVehicleType
          )
        }
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >

        {saving
          ? 'Mengirim...'
          : 'Ajukan Perubahan'}

      </button>

    </form>
  )
}