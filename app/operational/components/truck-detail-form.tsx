'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck as TruckIcon, Save, Loader2, Info } from 'lucide-react'

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

  const [trucks, setTrucks] = useState<Truck[]>(() =>
    requirements.flatMap((requirement) =>
      Array.from({ length: requirement.quantity }, () => ({
        vehicle_type: requirement.vehicle_type,
        plate_number: '',
        driver_name: '',
        driver_phone: '',
      }))
    )
  )

  const [saving, setSaving] = useState(false)

  function updateTruck(index: number, field: keyof Truck, value: string) {
    setTrucks((current) =>
      current.map((truck, i) =>
        i === index ? { ...truck, [field]: value } : truck
      )
    )
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    for (let i = 0; i < trucks.length; i++) {
      const truck = trucks[i]

      if (!truck.plate_number.trim()) {
        alert(`Plat Nomor Unit ${i + 1} wajib diisi.`)
        return
      }

      if (!truck.driver_name.trim()) {
        alert(`Nama Driver Unit ${i + 1} wajib diisi.`)
        return
      }

      if (!truck.driver_phone.trim()) {
        alert(`No. HP Driver Unit ${i + 1} wajib diisi.`)
        return
      }
    }

    setSaving(true)

    try {
      const { error: truckError } = await supabase
        .from('order_trucks')
        .insert(
          trucks.map((truck) => ({
            order_id: orderId,
            source: 'internal',
            vehicle_type: truck.vehicle_type,
            no_buntut: null,
            plate_number: truck.plate_number.trim(),
            driver_name: truck.driver_name.trim(),
            driver_phone: truck.driver_phone.trim(),
            vendor_name: null,
            status: 'waiting_hse',
          }))
        )

      if (truckError) {
        console.error('SAVE INTERNAL TRUCK ERROR:', truckError)
        alert(truckError.message)
        return
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'waiting_hse' })
        .eq('id', orderId)

      if (orderError) {
        console.error('UPDATE ORDER STATUS ERROR:', orderError)
        alert(orderError.message)
        return
      }

      alert(
        `Detail ${trucks.length} unit Internal berhasil disimpan dan dikirim ke HSE.`
      )

      router.push('/operational')
      router.refresh()
    } catch (error) {
      console.error('SAVE DETAIL UNIT ERROR:', error)
      alert('Terjadi kesalahan saat menyimpan detail unit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#01236A]/10">
            <TruckIcon className="h-5 w-5 text-[#01236A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Detail Unit Internal
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Isi detail kendaraan Internal yang akan menjalani pemeriksaan
              HSE.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-3 py-1.5 text-xs font-bold text-[#01236A]">
          {trucks.length} Unit
        </span>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-bold text-blue-900">Unit Internal</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            Form ini hanya untuk unit Internal sesuai hasil alokasi. Unit VM
            tidak perlu mengisi detail pada form ini dan tidak masuk
            pemeriksaan HSE.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {trucks.map((truck, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#01236A] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Unit Internal {index + 1}
                  </p>
                  <p className="text-xs text-gray-500">Detail kendaraan</p>
                </div>
              </div>

              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200">
                {truck.vehicle_type}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Jenis Unit
                </label>
                <input
                  type="text"
                  value={truck.vehicle_type}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-sm font-medium text-gray-600"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sumber Unit
                </label>
                <input
                  type="text"
                  value="Internal"
                  disabled
                  className="w-full rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-sm font-bold text-blue-700"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Plat Nomor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={truck.plate_number}
                  onChange={(event) =>
                    updateTruck(index, 'plate_number', event.target.value)
                  }
                  placeholder="Contoh: B 1234 XYZ"
                  required
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Nama Driver <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={truck.driver_name}
                  onChange={(event) =>
                    updateTruck(index, 'driver_name', event.target.value)
                  }
                  placeholder="Nama driver"
                  required
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  No. HP Driver <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={truck.driver_phone}
                  onChange={(event) =>
                    updateTruck(index, 'driver_phone', event.target.value)
                  }
                  placeholder="08xxxxxxxxxx"
                  required
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-gray-100 pt-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total unit Internal
          </div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            {trucks.length} Unit
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || trucks.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Menyimpan...' : 'Simpan Detail Unit'}
        </button>
      </div>
    </form>
  )
}