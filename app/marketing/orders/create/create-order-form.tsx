'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PlusCircle, Trash2, Save } from 'lucide-react'

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
      alert('Session login tidak ditemukan.')
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
      alert(error.message)
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
      alert(requirementError.message)
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
      alert(activityError.message)
      return
    }

    router.push('/marketing/orders')
    router.refresh()
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Create New Order
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Buat permintaan kendaraan baru.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="customer"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              id="customer"
              name="customer"
              type="text"
              placeholder="Contoh: Halliburton"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div>
            <label
              htmlFor="rft_tr_job"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              RFT / TR / Job
            </label>
            <input
              id="rft_tr_job"
              name="rft_tr_job"
              type="text"
              placeholder="Contoh: RFT-001 / TR-001 / JOB-001"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div>
            <label
              htmlFor="pk_number"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Nomor PK <span className="text-red-500">*</span>
            </label>
            <input
              id="pk_number"
              name="pk_number"
              type="text"
              placeholder="Contoh: PK/HI/26/1096"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kebutuhan Kendaraan <span className="text-red-500">*</span>
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  Satu order dapat memiliki beberapa jenis kendaraan.
                </p>
              </div>

              <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
                Total: {totalQuantity} Unit
              </span>
            </div>

            <div className="space-y-3">
              {requirements.map((requirement, index) => (
                <div
                  key={requirement.id}
                  className="flex items-end gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4"
                >
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-semibold text-gray-500">
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
                      className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
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
                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                      />
                    )}
                  </div>

                  <div className="w-32">
                    <label className="mb-2 block text-xs font-semibold text-gray-500">
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
                      className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRequirement(requirement.id)}
                    disabled={requirements.length === 1}
                    className="rounded-lg border border-gray-200 p-3 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRequirement}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <PlusCircle className="h-4 w-4" />
              Tambah Jenis Kendaraan
            </button>
          </div>

          <div>
            <label
              htmlFor="trip"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Trip <span className="text-red-500">*</span>
            </label>
            <input
              id="trip"
              name="trip"
              type="text"
              placeholder="Contoh: BSD Halliburton - ONWJ"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div>
            <label
              htmlFor="instruction"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Instruksi
            </label>
            <textarea
              id="instruction"
              name="instruction"
              rows={3}
              placeholder="Contoh: Tolong disiapkan untuk muat besok."
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div>
            <label
              htmlFor="bawa_ra"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Bawa RA
            </label>
            <select
              id="bawa_ra"
              name="bawa_ra"
              defaultValue="Tidak"
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            >
              <option value="Tidak">Tidak</option>
              <option value="Ya">Ya</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Catatan Tambahan
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Catatan tambahan jika diperlukan..."
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
            />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-6">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Total kebutuhan kendaraan
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {totalQuantity} Unit
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/marketing/orders"
                className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Batal
              </Link>

              <button
                type="submit"
                disabled={hasInvalidRequirement}
                className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
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