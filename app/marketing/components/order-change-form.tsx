'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Requirement = {
  id: string
  vehicle_type: string
  quantity: number
}

type OrderChangeFormProps = {
  orderId: string
  requirements: Requirement[]
  currentQuantity: number
}

export default function OrderChangeForm({
  orderId,
  requirements,
  currentQuantity,
}: OrderChangeFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // ==========================================
  // TAMBAH UNIT
  // ==========================================

  const [addVehicleType, setAddVehicleType] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')

  // ==========================================
  // KURANGI UNIT
  // ==========================================

  const [reduceVehicleType, setReduceVehicleType] = useState('')
  const [reduceQuantity, setReduceQuantity] = useState('1')
  const [reduceNote, setReduceNote] = useState('')

  const [saving, setSaving] = useState(false)

  // ==========================================
  // TAMBAH UNIT
  // ==========================================

  async function handleAddUnit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    const type = addVehicleType.trim()
    const amount = Number(addQuantity)

    if (!type) {
      alert('Jenis kendaraan wajib diisi.')
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      alert('Jumlah unit harus lebih dari 0.')
      return
    }

    setSaving(true)

    try {
      // ==========================================
      // USER
      // ==========================================

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      // ==========================================
      // CARI REQUIREMENT YANG SAMA
      // ==========================================

      const existingRequirement = requirements.find(
        (item) =>
          item.vehicle_type.toLowerCase() ===
          type.toLowerCase()
      )

      // ==========================================
      // UPDATE / INSERT REQUIREMENT
      // ==========================================

      if (existingRequirement) {
        const newRequirementQuantity =
          existingRequirement.quantity + amount

        const { error } = await supabase
          .from('order_requirements')
          .update({
            quantity: newRequirementQuantity,
          })
          .eq('id', existingRequirement.id)

        if (error) {
          console.error(
            'UPDATE REQUIREMENT ERROR:',
            error
          )

          alert(error.message)
          return
        }
      } else {
        const { error } = await supabase
          .from('order_requirements')
          .insert({
            order_id: orderId,
            vehicle_type: type,
            quantity: amount,
          })

        if (error) {
          console.error(
            'INSERT REQUIREMENT ERROR:',
            error
          )

          alert(error.message)
          return
        }
      }

      // ==========================================
      // UPDATE TOTAL ORDER
      // ==========================================

      const newOrderQuantity =
        currentQuantity + amount

      const { error: orderError } =
        await supabase
          .from('orders')
          .update({
            quantity: newOrderQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

      if (orderError) {
        console.error(
          'UPDATE ORDER QUANTITY ERROR:',
          orderError
        )

        alert(orderError.message)
        return
      }

      // ==========================================
      // ACTIVITY LOG
      // ==========================================

      const { error: logError } =
        await supabase
          .from('activity_logs')
          .insert({
            order_id: orderId,
            user_id: user.id,
            action: 'ADD_UNIT',
            old_value: JSON.stringify({
              vehicle_type:
                existingRequirement?.vehicle_type ||
                null,
              quantity:
                existingRequirement?.quantity ||
                0,
              order_quantity: currentQuantity,
            }),
            new_value: JSON.stringify({
              vehicle_type: type,
              added_quantity: amount,
              quantity: existingRequirement
                ? existingRequirement.quantity +
                  amount
                : amount,
              order_quantity: newOrderQuantity,
            }),
          })

      if (logError) {
        console.error(
          'ACTIVITY LOG ERROR:',
          logError
        )

        alert(
          `Unit berhasil ditambahkan, tetapi activity log gagal disimpan: ${logError.message}`
        )

        router.refresh()
        return
      }

      // ==========================================
      // SUCCESS
      // ==========================================

      alert(
        `Berhasil menambahkan ${amount} ${type}.`
      )

      setAddVehicleType('')
      setAddQuantity('1')

      router.refresh()
    } catch (error) {
      console.error(
        'ADD UNIT ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat menambahkan unit.'
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // REQUEST KURANGI UNIT
  // ==========================================

  async function handleReduceUnit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    const type = reduceVehicleType.trim()
    const amount = Number(reduceQuantity)
    const note = reduceNote.trim()

    if (!type) {
      alert('Jenis kendaraan wajib dipilih.')
      return
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      alert('Jumlah unit harus lebih dari 0.')
      return
    }

    if (!note) {
      alert('Alasan pengurangan unit wajib diisi.')
      return
    }

    // ==========================================
    // CEK REQUIREMENT
    // ==========================================

    const requirement = requirements.find(
      (item) =>
        item.vehicle_type.toLowerCase() ===
        type.toLowerCase()
    )

    if (!requirement) {
      alert(
        `Tidak ditemukan kebutuhan ${type} pada order ini.`
      )
      return
    }

    if (amount > requirement.quantity) {
      alert(
        `Tidak bisa mengurangi ${amount} unit. Kebutuhan ${type} saat ini hanya ${requirement.quantity} unit.`
      )
      return
    }

    setSaving(true)

    try {
      // ==========================================
      // USER
      // ==========================================

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      // ==========================================
      // CEK REQUEST YANG MASIH AKTIF
      // ==========================================

      const { data: order, error: orderFetchError } =
        await supabase
          .from('orders')
          .select(`
            reduce_unit_requested,
            reduce_unit_quantity,
            reduce_unit_vehicle_type
          `)
          .eq('id', orderId)
          .single()

      if (orderFetchError) {
        console.error(
          'GET REDUCE REQUEST ERROR:',
          orderFetchError
        )

        alert(orderFetchError.message)
        return
      }

      if (order?.reduce_unit_requested) {
        alert(
          'Masih ada request pengurangan unit yang belum diproses Operational.'
        )
        return
      }

      // ==========================================
      // SIMPAN REQUEST
      //
      // TIDAK mengurangi quantity.
      // TIDAK menghapus order_trucks.
      // ==========================================

      const { error: requestError } =
        await supabase
          .from('orders')
          .update({
            reduce_unit_requested: true,
            reduce_unit_quantity: amount,
            reduce_unit_vehicle_type: type,
            reduce_unit_note: note,
            reduce_unit_requested_by: user.id,
            reduce_unit_requested_at:
              new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

      if (requestError) {
        console.error(
          'SAVE REDUCE REQUEST ERROR:',
          requestError
        )

        alert(requestError.message)
        return
      }

      // ==========================================
      // ACTIVITY LOG
      // ==========================================

      const { error: logError } =
        await supabase
          .from('activity_logs')
          .insert({
            order_id: orderId,
            user_id: user.id,
            action: 'REQUEST_REDUCE_UNIT',
            old_value: JSON.stringify({
              vehicle_type: type,
              quantity: requirement.quantity,
              order_quantity: currentQuantity,
            }),
            new_value: JSON.stringify({
              requested_vehicle_type: type,
              requested_quantity: amount,
              reason: note,
              status: 'waiting_operational',
            }),
          })

      if (logError) {
        console.error(
          'REDUCE ACTIVITY LOG ERROR:',
          logError
        )

        alert(
          `Request berhasil dibuat, tetapi activity log gagal disimpan: ${logError.message}`
        )

        router.refresh()
        return
      }

      // ==========================================
      // SUCCESS
      // ==========================================

      alert(
        `Request pengurangan ${amount} ${type} berhasil dikirim ke Operational.`
      )

      setReduceVehicleType('')
      setReduceQuantity('1')
      setReduceNote('')

      router.refresh()
    } catch (error) {
      console.error(
        'REDUCE UNIT REQUEST ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat mengajukan pengurangan unit.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">

      {/* ==========================================
          HEADER
      ========================================== */}

      <div className="mb-6">

        <h2 className="text-lg font-semibold">
          Perubahan Order
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Kelola perubahan kebutuhan kendaraan.
        </p>

      </div>


      <div className="space-y-6">

        {/* ==========================================
            TAMBAH UNIT
        ========================================== */}

        <form
          onSubmit={handleAddUnit}
          className="rounded-lg border bg-gray-50 p-5"
        >

          <div className="mb-4">

            <h3 className="font-medium">
              Tambah Unit
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Tambahkan kebutuhan unit baru dari
              customer. Unit aktual akan diproses
              Operational.
            </p>

          </div>


          <div className="grid gap-4 md:grid-cols-3">

            {/* JENIS */}

            <div className="md:col-span-2">

              <label className="mb-1 block text-xs font-medium">
                Jenis Kendaraan
              </label>

              <input
                type="text"
                value={addVehicleType}
                onChange={(event) =>
                  setAddVehicleType(
                    event.target.value
                  )
                }
                placeholder="Contoh: Trailer"
                disabled={saving}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />

            </div>


            {/* JUMLAH */}

           <input
  type="number"
  min="1"
  step="1"
  value={addQuantity}
  onChange={(event) =>
    setAddQuantity(event.target.value)
  }
  disabled={saving}
  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
/>
          </div>


          <div className="mt-5 flex justify-end">

            <button
              type="submit"
              disabled={
                saving ||
                !addVehicleType.trim() ||
                !addQuantity
              }
              className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Menyimpan...'
                : '+ Tambah Unit'}
            </button>

          </div>

        </form>


        {/* ==========================================
            KURANGI UNIT
        ========================================== */}

        <form
          onSubmit={handleReduceUnit}
          className="rounded-lg border bg-gray-50 p-5"
        >

          <div className="mb-4">

            <h3 className="font-medium">
              Kurangi Unit
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Marketing hanya mengajukan jumlah
              pengurangan. Unit yang tidak jadi jalan
              akan ditentukan oleh Operational sesuai
              antrian dan kondisi unit.
            </p>

          </div>


          <div className="grid gap-4 md:grid-cols-3">

            {/* JENIS UNIT */}

            <div>

              <label className="mb-1 block text-xs font-medium">
                Jenis Kendaraan
              </label>

              <select
                value={reduceVehicleType}
                onChange={(event) =>
                  setReduceVehicleType(
                    event.target.value
                  )
                }
                disabled={saving}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              >

                <option value="">
                  Pilih kendaraan
                </option>

                {requirements.map(
                  (requirement) => (
                    <option
                      key={requirement.id}
                      value={
                        requirement.vehicle_type
                      }
                    >
                      {requirement.vehicle_type} (
                      {requirement.quantity}
                      )
                    </option>
                  )
                )}

              </select>

            </div>


            {/* JUMLAH */}

            <div>

              <label className="mb-1 block text-xs font-medium">
                Jumlah Dikurangi
              </label>

             <input
  type="number"
  min="1"
  max={
    requirements.find(
      (item) =>
        item.vehicle_type === reduceVehicleType
    )?.quantity || 1
  }
  step="1"
  value={reduceQuantity}
  onChange={(event) => {
    const selectedRequirement =
      requirements.find(
        (item) =>
          item.vehicle_type === reduceVehicleType
      )

    const maxQuantity =
      selectedRequirement?.quantity || 1

    const value = Number(event.target.value)

    if (value > maxQuantity) {
      setReduceQuantity(String(maxQuantity))
      return
    }

    setReduceQuantity(event.target.value)
  }}
  disabled={saving || !reduceVehicleType}
  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
/>

            </div>


            {/* ALASAN */}

            <div className="md:col-span-3">

              <label className="mb-1 block text-xs font-medium">
                Alasan Pengurangan
              </label>
              <textarea
                value={reduceNote}
                onChange={(event) =>
                  setReduceNote(
                    event.target.value
                  )
                }
                disabled={saving}
                rows={3}
                placeholder="Contoh: Customer mengurangi kebutuhan unit."
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />

            </div>

          </div>


          <div className="mt-5 flex items-center justify-between">

            <p className="text-xs text-gray-500">
              Unit belum akan dibatalkan sampai
              Operational menentukan unitnya.
            </p>

            <button
              type="submit"
              disabled={
                saving ||
                !reduceVehicleType ||
                !reduceQuantity ||
                !reduceNote.trim()
              }
              className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Mengirim...'
                : 'Ajukan Pengurangan'}
            </button>

          </div>

        </form>

      </div>

    </div>
  )
}