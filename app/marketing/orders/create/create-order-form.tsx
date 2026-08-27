'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
    setRequirements((current) =>
      current.filter((item) => item.id !== id)
    )
  }

  function updateVehicleType(
    id: number,
    vehicle_type: string
  ) {
    setRequirements((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, vehicle_type }
          : item
      )
    )
  }

  function updateCustomVehicleType(
  id: number,
  custom_vehicle_type: string
) {
  setRequirements((current) =>
    current.map((item) =>
      item.id === id
        ? { ...item, custom_vehicle_type }
        : item
    )
  )
}

  function updateQuantity(
    id: number,
    quantity: number
  ) {
    setRequirements((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: quantity < 1 ? 1 : quantity,
            }
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
    (item.vehicle_type === 'Lainnya' &&
      !item.custom_vehicle_type.trim()) ||
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

console.log('ORDER CREATED:', order)
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
  console.error(
    'CREATE REQUIREMENTS ERROR:',
    requirementError
  )

  alert(requirementError.message)
  return
}

console.log(
  'REQUIREMENTS CREATED:',
  requirementRows
)
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
  console.error(
    'ACTIVITY LOG ERROR:',
    activityError
  )

  alert(activityError.message)
  return
}

console.log('ACTIVITY LOG CREATED')
router.push('/marketing/orders')
router.refresh()
}


  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Create New Order
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Buat permintaan kendaraan baru.
          </p>
        </div>

        {/* FORM */}
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <form
  onSubmit={handleSubmit}
  className="space-y-6"
>
            {/* CUSTOMER */}
            <div>
              <label
                htmlFor="customer"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Customer <span className="text-red-500">*</span>
              </label>

              <input
                id="customer"
                name="customer"
                type="text"
                placeholder="Contoh: Halliburton"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* RFT / TR / JOB */}
            <div>
              <label
                htmlFor="rft_tr_job"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                RFT / TR / Job
              </label>

              <input
                id="rft_tr_job"
                name="rft_tr_job"
                type="text"
                placeholder="Contoh: RFT-001 / TR-001 / JOB-001"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* PK */}
            <div>
              <label
                htmlFor="pk_number"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Nomor PK <span className="text-red-500">*</span>
              </label>

              <input
                id="pk_number"
                name="pk_number"
                type="text"
                placeholder="Contoh: PK/HI/26/1096"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* VEHICLE REQUIREMENTS */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Kebutuhan Kendaraan{' '}
                    <span className="text-red-500">*</span>
                  </label>

                  <p className="mt-1 text-xs text-gray-500">
                    Satu order dapat memiliki beberapa jenis kendaraan.
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  Total: {totalQuantity} Unit
                </span>
              </div>

              <div className="space-y-3">
                {requirements.map((requirement, index) => (
                  <div
                    key={requirement.id}
                    className="flex items-end gap-3 rounded-lg border bg-gray-50 p-4"
                  >
                    {/* VEHICLE TYPE */}
                    <div className="flex-1">
                      <label className="mb-2 block text-xs font-medium text-gray-600">
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
                        className="w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-black"
                      >
                        
                        <option value="">
                          Pilih kendaraan
                        </option>

                        {vehicleTypes.map((vehicle) => (
                          <option
                            key={vehicle}
                            value={vehicle}
                          >
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
    className="mt-2 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-black"
  />
)}
                    </div>

                    {/* QUANTITY */}
                    <div className="w-32">
                      <label className="mb-2 block text-xs font-medium text-gray-600">
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
                        className="w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>

                    {/* DELETE */}
                    <button
                      type="button"
                      onClick={() =>
                        removeRequirement(requirement.id)
                      }
                      disabled={requirements.length === 1}
                      className="rounded-lg border px-4 py-3 text-sm text-gray-500 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>

              {/* ADD */}
              <button
                type="button"
                onClick={addRequirement}
                className="mt-3 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                + Tambah Jenis Kendaraan
              </button>
            </div>

            {/* TRIP */}
            <div>
              <label
                htmlFor="trip"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Trip <span className="text-red-500">*</span>
              </label>

              <input
                id="trip"
                name="trip"
                type="text"
                placeholder="Contoh: BSD Halliburton - ONWJ"
                className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* INSTRUCTION */}
            <div>
              <label
                htmlFor="instruction"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Instruksi
              </label>

              <textarea
                id="instruction"
                name="instruction"
                rows={3}
                placeholder="Contoh: Tolong disiapkan untuk muat besok."
                className="w-full resize-none rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* BAWA RA */}
            <div>
              <label
                htmlFor="bawa_ra"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Bawa RA
              </label>

              <select
                id="bawa_ra"
                name="bawa_ra"
                defaultValue="Tidak"
                className="w-full rounded-lg border bg-white px-4 py-3 text-sm outline-none focus:border-black"
              >
                <option value="Tidak">Tidak</option>
                <option value="Ya">Ya</option>
              </select>
            </div>

            {/* NOTES */}
            <div>
              <label
                htmlFor="notes"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Catatan Tambahan
              </label>

              <textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Catatan tambahan jika diperlukan..."
                className="w-full resize-none rounded-lg border px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {/* ACTION */}
            <div className="flex items-center justify-between border-t pt-6">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Total kebutuhan kendaraan
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {totalQuantity} Unit
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/marketing/orders"
                  className="rounded-lg border px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Batal
                </Link>

               <button
  type="submit"
  disabled={hasInvalidRequirement}
  className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
>
  Simpan Order
</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}