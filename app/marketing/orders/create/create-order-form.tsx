'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { PlusCircle, Trash2, Save } from 'lucide-react'
import { logOrderHistory } from '@/lib/history'

type VehicleRequirement = {
  id: number
  vehicle_type: string
  custom_vehicle_type: string
  quantity: number
}

const vehicleTypes = [
  'Trailer',
  'Lowbed',
  'Fuso',
  'Tronton',
  'Colt Diesel',
  'Pickup',
  'Double Cabin',
  'Prime Mover',
  'Lainnya',
]

export default function CreateOrderForm() {
  const router = useRouter()
  const toast = useToast()

  const [requirements, setRequirements] = useState<VehicleRequirement[]>([
    {
      id: 1,
      vehicle_type: '',
      custom_vehicle_type: '',
      quantity: 1,
    },
  ])

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        id: Date.now(),
        vehicle_type: '',
        custom_vehicle_type: '',
        quantity: 1,
      },
    ])
  }

  function removeRequirement(id: number) {
    setRequirements((current) => current.filter((item) => item.id !== id))
  }

  function updateVehicleType(id: number, vehicle_type: string) {
    setRequirements((current) =>
      current.map((item) =>
        item.id === id ? { ...item, vehicle_type } : item
      )
    )
  }

  function updateCustomVehicleType(id: number, custom_vehicle_type: string) {
    setRequirements((current) =>
      current.map((item) =>
        item.id === id ? { ...item, custom_vehicle_type } : item
      )
    )
  }

  function updateQuantity(id: number, quantity: number) {
    setRequirements((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, quantity: quantity < 1 ? 1 : quantity }
          : item
      )
    )
  }

  const totalQuantity = requirements.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const hasInvalidRequirement = requirements.some(
    (item) =>
      !item.vehicle_type ||
      (item.vehicle_type === 'Lainnya' && !item.custom_vehicle_type.trim()) ||
      item.quantity < 1
  )

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (hasInvalidRequirement) {
      return
    }

    const supabase = createClient()

    const formData = new FormData(event.currentTarget)

    const customer = formData.get('customer') as string
    const rft_tr_job = formData.get('rft_tr_job') as string
    const pk_number = formData.get('pk_number') as string
    const trip = formData.get('trip') as string
    const instruction = formData.get('instruction') as string
    const bawa_ra = formData.get('bawa_ra') as string
    const notes = formData.get('notes') as string

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
      return
    }

    const vehicleSummary = requirements
      .map((item) =>
        item.vehicle_type === 'Lainnya'
          ? item.custom_vehicle_type
          : item.vehicle_type
      )
      .join(', ')

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer,
        rft_tr_job,
        pk_number,
        vehicle_type: vehicleSummary,
        quantity: totalQuantity,
        trip,
        status: 'waiting_unit',
        instruction,
        bawa_ra,
        notes,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('CREATE ORDER ERROR:', error)
      toast.error('Gagal Membuat Order', error.message)
      return
    }

    const requirementRows = requirements.map((item) => ({
      order_id: order.id,
      vehicle_type:
        item.vehicle_type === 'Lainnya'
          ? item.custom_vehicle_type
          : item.vehicle_type,
      quantity: item.quantity,
    }))

    const { error: requirementError } = await supabase
      .from('order_requirements')
      .insert(requirementRows)

    if (requirementError) {
      console.error('CREATE REQUIREMENTS ERROR:', requirementError)
      toast.error('Gagal Menyimpan Kebutuhan Kendaraan', requirementError.message)
      return
    }

    const { error: activityError } = await supabase
      .from('activity_logs')
      .insert({
        order_id: order.id,
        user_id: user.id,
        action: 'CREATE_ORDER',
        old_value: null,
        new_value: {
          customer,
          pk_number,
          total_quantity: totalQuantity,
        },
      })

       if (activityError) {
      console.error('ACTIVITY LOG ERROR:', activityError)
      toast.error('Gagal Menyimpan Activity Log', activityError.message)
      return
    }

    await logOrderHistory({
      orderId: order.id,
      action: 'create_order',
      fieldName: 'status',
      oldValue: null,
      newValue: 'waiting_unit',
      reason: `Order baru untuk ${customer}, ${totalQuantity} unit.`,
      changedBy: user.id,
    })

    toast.success('Order Berhasil Dibuat', `Order untuk ${customer} berhasil disimpan.`)

    router.push('/marketing/orders')
    router.refresh()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10'

  const labelClass =
    'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Order
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Buat permintaan kendaraan baru.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="customer" className={labelClass}>
                Customer <span className="text-red-500">*</span>
              </label>
              <input
                id="customer"
                name="customer"
                type="text"
                placeholder="Contoh: Halliburton"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="pk_number" className={labelClass}>
                Nomor PK <span className="text-red-500">*</span>
              </label>
              <input
                id="pk_number"
                name="pk_number"
                type="text"
                placeholder="Contoh: PK/HI/26/1096"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="rft_tr_job" className={labelClass}>
                RFT / TR / Job
              </label>
              <input
                id="rft_tr_job"
                name="rft_tr_job"
                type="text"
                placeholder="Contoh: RFT-001"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="trip" className={labelClass}>
                Trip <span className="text-red-500">*</span>
              </label>
              <input
                id="trip"
                name="trip"
                type="text"
                placeholder="Contoh: BSD - ONWJ"
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className={labelClass}>
                  Kebutuhan Kendaraan <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400">
                  Satu order dapat memiliki beberapa jenis kendaraan.
                </p>
              </div>

              <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
                Total: {totalQuantity} Unit
              </span>
            </div>

            <div className="space-y-2.5">
              {requirements.map((requirement, index) => (
                <div
                  key={requirement.id}
                  className="flex items-end gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5"
                >
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      Jenis Kendaraan {index + 1}
                    </label>
                    <select
                      value={requirement.vehicle_type}
                      onChange={(event) =>
                        updateVehicleType(
                          requirement.id,
                          event.target.value
                        )
                      }
                      className={`bg-white ${inputClass}`}
                    >
                      <option value="">Pilih kendaraan</option>
                      {vehicleTypes.map((vehicle) => (
                        <option key={vehicle} value={vehicle}>
                          {vehicle}
                        </option>
                      ))}
                    </select>

                    {requirement.vehicle_type === 'Lainnya' && (
                      <input
                        type="text"
                        value={requirement.custom_vehicle_type}
                        onChange={(event) =>
                          updateCustomVehicleType(
                            requirement.id,
                            event.target.value
                          )
                        }
                        placeholder="Tulis jenis kendaraan"
                        className={`mt-2 bg-white ${inputClass}`}
                      />
                    )}
                  </div>

                  <div className="w-20">
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      Jumlah
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={requirement.quantity}
                      onChange={(event) =>
                        updateQuantity(
                          requirement.id,
                          Number(event.target.value)
                        )
                      }
                      className={`bg-white ${inputClass}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRequirement(requirement.id)}
                    disabled={requirements.length === 1}
                    className="rounded-lg border border-gray-200 p-2.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRequirement}
              className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Tambah Jenis Kendaraan
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-gray-100 pt-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="instruction" className={labelClass}>
                Instruksi
              </label>
              <textarea
                id="instruction"
                name="instruction"
                rows={2}
                placeholder="Contoh: Tolong disiapkan untuk muat besok."
                className={`resize-none ${inputClass}`}
              />
            </div>

            <div>
              <label htmlFor="bawa_ra" className={labelClass}>
                Bawa RA
              </label>
              <select
                id="bawa_ra"
                name="bawa_ra"
                defaultValue="Tidak"
                className={`bg-white ${inputClass}`}
              >
                <option value="Tidak">Tidak</option>
                <option value="Ya">Ya</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className={labelClass}>
                Catatan Tambahan
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Catatan tambahan jika diperlukan..."
                className={`resize-none ${inputClass}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total kebutuhan
              </p>
              <p className="text-xl font-bold text-gray-900">
                {totalQuantity} Unit
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/marketing/orders"
                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Batal
              </Link>

              <button
                type="submit"
                disabled={hasInvalidRequirement}
                className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                Simpan Order
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}