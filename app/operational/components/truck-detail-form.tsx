'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import {
  Truck as TruckIcon,
  Save,
  Loader2,
} from 'lucide-react'

type Requirement = {
  id: number | string
  vehicle_type: string
  quantity: number
}

type TruckDetailFormProps = {
  orderId: string
  requirements: Requirement[]
}

type Truck = {
  vehicle_type: string
  plate_number: string
  driver_name: string
  driver_phone: string
}

export default function TruckDetailForm({
  orderId,
  requirements,
}: TruckDetailFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // ==========================================
  // BUAT FORM BERDASARKAN JUMLAH INTERNAL
  //
  // Contoh:
  //
  // Trailer = 3
  //
  // Maka:
  // Unit 1 = Trailer
  // Unit 2 = Trailer
  // Unit 3 = Trailer
  //
  // VM TIDAK MASUK KE FORM INI.
  // ==========================================

  const [trucks, setTrucks] = useState<Truck[]>(() =>
    requirements.flatMap((requirement) =>
      Array.from(
        {
          length: requirement.quantity,
        },
        () => ({
          vehicle_type:
            requirement.vehicle_type,

          plate_number: '',

          driver_name: '',

          driver_phone: '',
        })
      )
    )
  )

  const [saving, setSaving] =
    useState(false)

  // ==========================================
  // UPDATE DETAIL UNIT
  // ==========================================

  function updateTruck(
    index: number,
    field: keyof Truck,
    value: string
  ) {
    setTrucks((current) =>
      current.map((truck, i) =>
        i === index
          ? {
              ...truck,
              [field]: value,
            }
          : truck
      )
    )
  }

  // ==========================================
  // SUBMIT
  // ==========================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    // ==========================================
    // VALIDASI
    // ==========================================

    for (
      let i = 0;
      i < trucks.length;
      i++
    ) {
      const truck = trucks[i]

      if (
        !truck.plate_number.trim()
      ) {
        alert(
          `Plat Nomor Unit ${
            i + 1
          } wajib diisi.`
        )

        return
      }

      if (
        !truck.driver_name.trim()
      ) {
        alert(
          `Nama Driver Unit ${
            i + 1
          } wajib diisi.`
        )

        return
      }

      if (
        !truck.driver_phone.trim()
      ) {
        alert(
          `No. HP Driver Unit ${
            i + 1
          } wajib diisi.`
        )

        return
      }
    }

    setSaving(true)

    try {
      // ==========================================
      // SIMPAN DETAIL UNIT INTERNAL
      //
      // SEMUA YANG DISIMPAN DI SINI:
      // source = internal
      // status = waiting_hse
      //
      // VM TIDAK DISIMPAN DI SINI.
      // ==========================================

      const {
        error: truckError,
      } = await supabase
        .from('order_trucks')
        .insert(
          trucks.map((truck) => ({
            order_id:
              orderId,

            // ==================================
            // WAJIB INTERNAL
            // ==================================

            source:
              'internal',

            vehicle_type:
              truck.vehicle_type,

            // No. Buntut belum diisi
            no_buntut:
              null,

            plate_number:
              truck.plate_number.trim(),

            driver_name:
              truck.driver_name.trim(),

            driver_phone:
              truck.driver_phone.trim(),

            // Internal tidak punya vendor
            vendor_name:
              null,

            // ==================================
            // INTERNAL → HSE
            // ==================================

            status:
              'waiting_hse',
          }))
        )

      if (truckError) {
        console.error(
          'SAVE INTERNAL TRUCK ERROR:',
          truckError
        )

        alert(
          truckError.message
        )

        return
      }

      // ==========================================
      // UPDATE STATUS ORDER
      //
      // Karena ada internal:
      // waiting_hse
      // ==========================================

      const {
        error: orderError,
      } = await supabase
        .from('orders')
        .update({
          status:
            'waiting_hse',
        })
        .eq(
          'id',
          orderId
        )

      if (orderError) {
        console.error(
          'UPDATE ORDER STATUS ERROR:',
          orderError
        )

        alert(
          orderError.message
        )

        return
      }

      // ==========================================
      // SUCCESS
      // ==========================================

      alert(
        `Detail ${trucks.length} unit Internal berhasil disimpan dan dikirim ke HSE.`
      )

      router.push(
        '/operational'
      )

      router.refresh()

    } catch (error) {
      console.error(
        'SAVE DETAIL UNIT ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat menyimpan detail unit.'
      )

    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >

      {/* ==========================================
          HEADER
      ========================================== */}

      <div className="mb-5">

        <div className="flex items-center justify-between">

          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">

            <TruckIcon className="h-4.5 w-4.5 text-gray-400" />

            Detail Unit Internal

          </h2>

          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">

            {trucks.length} Unit

          </span>

        </div>

        <p className="mt-1 text-sm text-gray-500">

          Isi detail kendaraan Internal yang
          akan menjalani pemeriksaan HSE.

        </p>

      </div>

      {/* ==========================================
          INFO
      ========================================== */}

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">

        <div className="flex items-start gap-3">

          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            i
          </div>

          <div>

            <p className="text-sm font-semibold text-blue-900">
              Unit Internal
            </p>

            <p className="mt-1 text-xs leading-5 text-blue-700">

              Form ini hanya untuk unit Internal
              sesuai hasil alokasi. Unit VM tidak
              perlu mengisi detail pada form ini
              dan tidak masuk pemeriksaan HSE.

            </p>

          </div>

        </div>

      </div>

      {/* ==========================================
          LIST UNIT
      ========================================== */}

      <div className="space-y-5">

        {trucks.map(
          (
            truck,
            index
          ) => (

            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >

              {/* ==================================
                  HEADER UNIT
              ================================== */}

              <div className="mb-4 flex items-center justify-between">

                <div className="flex items-center gap-2 font-medium text-gray-900">

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">

                    {index + 1}

                  </span>

                  <div>

                    <p className="text-sm font-semibold">
                      Unit Internal {index + 1}
                    </p>

                    <p className="text-xs font-normal text-gray-500">
                      Detail kendaraan
                    </p>

                  </div>

                </div>

                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">

                  {truck.vehicle_type}

                </span>

              </div>

              {/* ==================================
                  FORM
              ================================== */}

              <div className="grid gap-4 md:grid-cols-2">

                {/* ==================================
                    JENIS UNIT
                ================================== */}

                <div>

                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Jenis Unit
                  </label>

                  <input
                    type="text"
                    value={
                      truck.vehicle_type
                    }
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600"
                  />

                </div>

                {/* ==================================
                    SUMBER UNIT
                ================================== */}

                <div>

                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Sumber Unit
                  </label>

                  <input
                    type="text"
                    value="Internal"
                    disabled
                    className="w-full rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700"
                  />

                </div>

                {/* ==================================
                    PLAT NOMOR
                ================================== */}

                <div>

                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">

                    Plat Nomor

                    <span className="ml-1 text-red-500">
                      *
                    </span>

                  </label>

                  <input
                    type="text"
                    value={
                      truck.plate_number
                    }
                    onChange={(
                      event
                    ) =>
                      updateTruck(
                        index,
                        'plate_number',
                        event.target.value
                      )
                    }
                    placeholder="Contoh: B 1234 XYZ"
                    required
                    disabled={
                      saving
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                </div>

                {/* ==================================
                    DRIVER
                ================================== */}

                <div>

                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">

                    Nama Driver

                    <span className="ml-1 text-red-500">
                      *
                    </span>

                  </label>

                  <input
                    type="text"
                    value={
                      truck.driver_name
                    }
                    onChange={(
                      event
                    ) =>
                      updateTruck(
                        index,
                        'driver_name',
                        event.target.value
                      )
                    }
                    placeholder="Nama driver"
                    required
                    disabled={
                      saving
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                </div>

                {/* ==================================
                    PHONE
                ================================== */}

                <div>

                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">

                    No. HP Driver

                    <span className="ml-1 text-red-500">
                      *
                    </span>

                  </label>

                  <input
                    type="text"
                    value={
                      truck.driver_phone
                    }
                    onChange={(
                      event
                    ) =>
                      updateTruck(
                        index,
                        'driver_phone',
                        event.target.value
                      )
                    }
                    placeholder="08xxxxxxxxxx"
                    required
                    disabled={
                      saving
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />

                </div>

              </div>

            </div>

          )
        )}

      </div>

      {/* ==========================================
          TOTAL + BUTTON
      ========================================== */}

      <div className="mt-5 flex items-end justify-between border-t border-gray-200 pt-5">

        <div>

          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Total unit Internal
          </div>

          <div className="mt-1 text-lg font-semibold text-gray-900">
            {trucks.length} Unit
          </div>

        </div>

        <button
          type="submit"
          disabled={
            saving ||
            trucks.length === 0
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
            : 'Simpan Detail Unit'}

        </button>

      </div>

    </form>
  )
}