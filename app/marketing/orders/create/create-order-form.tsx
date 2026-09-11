'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { logOrderHistory } from '@/lib/history'
import { PlusCircle, Trash2, Save, Loader2 } from 'lucide-react'
import CustomerAutocomplete from '@/app/marketing/components/customer-autocomplete'
import VehicleTypeAutocomplete from '@/app/marketing/components/vehicle-type-autocomplete'

type VehicleRequirement = {
  id: number
  vehicle_type: string
  quantity: number
}

export default function CreateOrderForm() {
  const router = useRouter()
  const toast = useToast()

  const [saving, setSaving] = useState(false)
  const [customer, setCustomer] = useState('')

  const [requirements, setRequirements] = useState<VehicleRequirement[]>([
    {
      id: 1,
      vehicle_type: '',
      quantity: 1,
    },
  ])

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        id: Date.now(),
        vehicle_type: '',
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
    (item) => !item.vehicle_type.trim() || item.quantity < 1
  )

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

      if (!customer.trim()) {
      toast.error('Data Belum Lengkap', 'Customer wajib diisi.')
      return
    }

    if (hasInvalidRequirement) {
      return
    }

    setSaving(true)

    const supabase = createClient()

    const formData = new FormData(event.currentTarget)

    const rft_tr_job = formData.get('rft_tr_job') as string
    const pk_number = formData.get('pk_number') as string
    const trip = formData.get('trip') as string

    const trimmedPk = pk_number?.trim() || ''
    const trimmedRft = rft_tr_job?.trim() || ''

    if (!trimmedPk && !trimmedRft) {
      toast.error(
        'Data Belum Lengkap',
        'Isi minimal salah satu: Nomor PK atau RFT/TR/Job.'
      )
      setSaving(false)
      return
    }

    const orderType = trimmedPk ? 'PK' : 'RFT'
    const instruction = formData.get('instruction') as string
    const bawa_ra = formData.get('bawa_ra') as string
    const notes = formData.get('notes') as string

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
      setSaving(false)
      return
    }

    // ==========================================
    // RESOLVE CUSTOMER KE MASTER (pakai nama kanonik)
    // ==========================================

    const { data: existingCustomer, error: customerLookupError } =
      await supabase
        .from('customers')
        .select('id, name')
        .ilike('name', customer.trim())
        .maybeSingle()

    if (customerLookupError) {
      console.error('LOOKUP CUSTOMER ERROR:', customerLookupError)
    }

    let canonicalCustomer = customer.trim()

    if (existingCustomer) {
      canonicalCustomer = existingCustomer.name
    } else {
      const { data: newCustomer, error: customerInsertError } =
        await supabase
          .from('customers')
          .insert({
            name: customer.trim(),
            created_by: user.id,
          })
          .select('name')
          .single()

      if (customerInsertError) {
        console.error('SAVE NEW CUSTOMER ERROR:', customerInsertError)
      } else if (newCustomer) {
        canonicalCustomer = newCustomer.name
      }
    }

    // ==========================================
    // RESOLVE JENIS KENDARAAN KE MASTER (pakai nama kanonik)
    // ==========================================

    const canonicalRequirements: VehicleRequirement[] = []

    for (const requirement of requirements) {
      const trimmedType = requirement.vehicle_type.trim()

      const { data: existingVehicleType, error: vehicleLookupError } =
        await supabase
          .from('vehicle_types')
          .select('id, name')
          .ilike('name', trimmedType)
          .maybeSingle()

      if (vehicleLookupError) {
        console.error('LOOKUP VEHICLE TYPE ERROR:', vehicleLookupError)
      }

      let canonicalType = trimmedType

      if (existingVehicleType) {
        canonicalType = existingVehicleType.name
      } else {
        const { data: newVehicleType, error: vehicleTypeInsertError } =
          await supabase
            .from('vehicle_types')
            .insert({
              name: trimmedType,
              created_by: user.id,
            })
            .select('name')
            .single()

        if (vehicleTypeInsertError) {
          console.error(
            'SAVE NEW VEHICLE TYPE ERROR:',
            vehicleTypeInsertError
          )
        } else if (newVehicleType) {
          canonicalType = newVehicleType.name
        }
      }

      canonicalRequirements.push({
        ...requirement,
        vehicle_type: canonicalType,
      })
    }

    const vehicleSummary = canonicalRequirements
      .map((item) => item.vehicle_type)
      .join(', ')

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer: canonicalCustomer,
        order_type: orderType,
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

      if (error.code === '23505') {
        toast.error(
          'Nomor PK Sudah Dipakai',
          'Nomor PK ini sudah digunakan order lain. Cek kembali nomor PK-nya.'
        )
      } else if (error.code === '23514') {
        toast.error(
          'Data Belum Lengkap',
          'Customer, Trip, dan minimal salah satu (PK atau RFT/TR/Job) wajib diisi.'
        )
      } else {
        toast.error('Gagal Membuat Order', error.message)
      }

      setSaving(false)
      return
    }

    const requirementRows = canonicalRequirements.map((item) => ({
      order_id: order.id,
      vehicle_type: item.vehicle_type,
      quantity: item.quantity,
    }))

    const { error: requirementError } = await supabase
      .from('order_requirements')
      .insert(requirementRows)

    if (requirementError) {
      console.error('CREATE REQUIREMENTS ERROR:', requirementError)
      toast.error('Gagal Menyimpan Kebutuhan Kendaraan', requirementError.message)
      setSaving(false)
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
          customer: canonicalCustomer,
          pk_number,
          total_quantity: totalQuantity,
        },
      })

    if (activityError) {
      console.error('ACTIVITY LOG ERROR:', activityError)
      toast.error('Gagal Menyimpan Activity Log', activityError.message)
      setSaving(false)
      return
    }

    await logOrderHistory({
      orderId: order.id,
      action: 'create_order',
      fieldName: 'status',
      oldValue: null,
      newValue: 'waiting_unit',
      reason: `Order baru untuk ${canonicalCustomer}, ${totalQuantity} unit.`,
      changedBy: user.id,
    })

    toast.success(
      'Order Berhasil Dibuat',
      `Order untuk ${canonicalCustomer} berhasil disimpan.`
    )

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
              <CustomerAutocomplete
                value={customer}
                onChange={setCustomer}
                disabled={saving}
              />
            </div>

                        <div>
              <label htmlFor="pk_number" className={labelClass}>
                Nomor PK
              </label>
              <input
                id="pk_number"
                name="pk_number"
                type="text"
                placeholder="Contoh: PK/HI/26/1096"
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
                className={inputClass}
              />
            </div>
          </div>

          <p className="-mt-2 text-xs text-gray-400">
            Isi minimal salah satu: Nomor PK atau RFT/TR/Job.
          </p>

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
                    <VehicleTypeAutocomplete
                      value={requirement.vehicle_type}
                      onChange={(value) =>
                        updateVehicleType(requirement.id, value)
                      }
                      disabled={saving}
                    />
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
                      disabled={saving}
                      className={`bg-white ${inputClass}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRequirement(requirement.id)}
                    disabled={requirements.length === 1 || saving}
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
              disabled={saving}
              className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                                               disabled={hasInvalidRequirement || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Menyimpan...' : 'Simpan Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}