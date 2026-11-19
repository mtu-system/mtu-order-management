'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { logOrderHistory } from '@/lib/history'
import {
  PlusCircle,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Circle,
  History,
} from 'lucide-react'
import CustomerAutocomplete from '@/app/marketing/components/customer-autocomplete'
import VehicleTypeAutocomplete from '@/app/marketing/components/vehicle-type-autocomplete'
import PageHeader from '@/app/components/page-header'
import { OrderStatusBadge } from '@/app/components/status-badge'
import LocationPicker from '@/app/components/location-picker'
import type { Geofence } from '@/lib/geo'

type VehicleRequirement = {
  id: number
  vehicle_type: string
  quantity: number
}

type RecentOrder = {
  id: string
  created_at: string
  pk_number: string | null
  rft_tr_job: string | null
  trip: string | null
  quantity: number | null
  status: string | null
}

// Escape wildcard ilike supaya nama customer dicocokkan persis.
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export default function CreateOrderForm() {
  const router = useRouter()
  const toast = useToast()

  const [saving, setSaving] = useState(false)
  const [customer, setCustomer] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [bookingDate, setBookingDate] = useState('')

  // Hanya untuk panel ringkasan -- nilai tetap dibaca dari FormData saat submit.
  const [pkNumber, setPkNumber] = useState('')
  const [rftTrJob, setRftTrJob] = useState('')
  const [trip, setTrip] = useState('')
  const [bawaRa, setBawaRa] = useState('Tidak')
  const [instruction, setInstruction] = useState('')
  const [notes, setNotes] = useState('')

  // Lokasi muat & bongkar (geofence) -- dasar jam otomatis laporan
  // Monitoring Update. Opsional, tapi tanpa ini jam tidak bisa terisi tepat.
  const [fences, setFences] = useState<Geofence[]>([])
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('')

  useEffect(() => {
    let cancelled = false
    createClient()
      .from('geofences')
      .select('id, name, type, lat, lng, radius_m')
      .neq('type', 'pool')
      .then(({ data }) => {
        if (!cancelled) setFences((data || []) as Geofence[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const originFence = fences.find((fence) => String(fence.id) === originId)
  const destinationFence = fences.find((fence) => String(fence.id) === destinationId)

  function pickLocation(kind: 'origin' | 'destination', id: string) {
    const nextOrigin = kind === 'origin' ? id : originId
    const nextDestination = kind === 'destination' ? id : destinationId
    if (kind === 'origin') setOriginId(id)
    else setDestinationId(id)

    // Trip masih kosong -> isi dari nama lokasi.
    const o = fences.find((fence) => String(fence.id) === nextOrigin)
    const d = fences.find((fence) => String(fence.id) === nextDestination)
    if (!trip.trim() && o && d) setTrip(`${o.name} - ${d.name}`)
  }

  function addFence(fence: Geofence) {
    setFences((current) => [...current.filter((item) => item.id !== fence.id), fence])
  }

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [recentFor, setRecentFor] = useState('')

  const [requirements, setRequirements] = useState<VehicleRequirement[]>([
    {
      id: 1,
      vehicle_type: '',
      quantity: 1,
    },
  ])

  // Order terakhir customer ini (read-only, ikut RLS: marketing hanya
  // melihat order miliknya, marketing_admin melihat semua).
  useEffect(() => {
    const name = customer.trim()
    let cancelled = false

    const timer = setTimeout(async () => {
      if (name.length < 2) {
        setRecentOrders([])
        setRecentFor('')
        setRecentLoading(false)
        return
      }

      setRecentLoading(true)
      const { data } = await createClient()
        .from('orders')
        .select('id, created_at, pk_number, rft_tr_job, trip, quantity, status')
        .ilike('customer', escapeLike(name))
        .order('created_at', { ascending: false })
        .limit(3)

      if (cancelled) return
      setRecentOrders((data || []) as RecentOrder[])
      setRecentFor(name)
      setRecentLoading(false)
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [customer])

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

    if (isBooking && !bookingDate) {
      toast.error('Data Belum Lengkap', 'Tanggal kebutuhan booking wajib diisi.')
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

if (!isBooking && !trimmedPk && !trimmedRft) {
  toast.error(
    'Data Belum Lengkap',
    'Isi minimal salah satu: Nomor PK atau RFT/TR/Job.'
  )
  setSaving(false)
  return
}

const orderType = trimmedPk ? 'PK' : trimmedRft ? 'RFT' : null
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

    const locationFields = {
      ...(originId ? { origin_fence_id: originId } : {}),
      ...(destinationId ? { destination_fence_id: destinationId } : {}),
    }

    const insertOrder = (extra: Record<string, string>) =>
      supabase
        .from('orders')
        .insert({ ...baseOrder, ...extra })
        .select()
        .single()

    const baseOrder = {
      customer: canonicalCustomer,
      order_type: orderType,
      rft_tr_job,
      pk_number,
      vehicle_type: vehicleSummary,
      quantity: totalQuantity,
      trip,
      status: isBooking ? 'booking_review' : 'waiting_unit',
      is_booking: isBooking,
      booking_date: isBooking ? bookingDate : null,
      instruction,
      bawa_ra,
      notes,
      created_by: user.id,
    }

    let { data: order, error } = await insertOrder(locationFields)

    // Migrasi lokasi order belum dijalankan: simpan tanpa lokasi.
    if (error && /origin_fence_id|destination_fence_id/.test(error.message || '')) {
      ;({ data: order, error } = await insertOrder({}))
    }

    if (error || !order) {
      console.error('CREATE ORDER ERROR:', error)

      if (error?.code === '23505') {
        toast.error(
          'Nomor PK Sudah Dipakai',
          'Nomor PK ini sudah digunakan order lain. Cek kembali nomor PK-nya.'
        )
      } else if (error?.code === '23514') {
        toast.error(
          'Data Belum Lengkap',
          'Customer, Trip, dan minimal salah satu (PK atau RFT/TR/Job) wajib diisi.'
        )
      } else {
        toast.error('Gagal Membuat Order', error?.message || 'Order tidak tersimpan.')
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
      newValue: isBooking ? 'booking_review' : 'waiting_unit',
      reason: isBooking
        ? `Booking baru untuk ${canonicalCustomer}, ${totalQuantity} unit, kebutuhan tanggal ${bookingDate}.`
        : `Order baru untuk ${canonicalCustomer}, ${totalQuantity} unit.`,
      changedBy: user.id,
    })

    toast.success(
      isBooking ? 'Booking Berhasil Dibuat' : 'Order Berhasil Dibuat',
      isBooking
        ? `Booking untuk ${canonicalCustomer} berhasil disimpan, menunggu cek kapasitas Operational.`
        : `Order untuk ${canonicalCustomer} berhasil disimpan.`
    )

    router.push('/marketing/orders')
    router.refresh()
  }

  const inputClass =
    'h-9 w-full rounded-md border border-[var(--border-strong)] bg-white px-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10 disabled:bg-slate-50'

  const textareaClass =
    'w-full resize-none rounded-md border border-[var(--border-strong)] bg-white px-3 py-2 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10 disabled:bg-slate-50'

  const labelClass = 'mb-1 block text-[12px] font-semibold text-slate-700'

  const hasIdentity = isBooking || Boolean(pkNumber.trim() || rftTrJob.trim())

  const checks = [
    { label: 'Customer diisi', ok: Boolean(customer.trim()) },
    {
      label: isBooking ? 'PK / RFT (opsional untuk booking)' : 'Nomor PK atau RFT/TR/Job',
      ok: hasIdentity,
    },
    { label: 'Trip diisi', ok: Boolean(trip.trim()) },
    {
      label: 'Lokasi muat & bongkar (agar jam terisi otomatis)',
      ok: Boolean(originId && destinationId),
    },
    { label: 'Jenis & jumlah kendaraan lengkap', ok: !hasInvalidRequirement },
    ...(isBooking
      ? [{ label: 'Tanggal kebutuhan booking', ok: Boolean(bookingDate) }]
      : []),
  ]

  const filledRequirements = requirements.filter((item) => item.vehicle_type.trim())

  return (
    <div>
      <PageHeader
        title={isBooking ? 'Buat Booking Baru' : 'Buat Order Baru'}
        subtitle="Isi detail permintaan kendaraan untuk customer. Field bertanda * wajib diisi."
      />

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        {/* ===== KIRI: FORM PER BAGIAN ===== */}
        <div className="space-y-4">
          <FormSection number={1} title="Customer & PK">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label htmlFor="customer" className={labelClass}>
                  Customer <span className="text-red-600">*</span>
                </label>
                <CustomerAutocomplete
                  value={customer}
                  onChange={setCustomer}
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-1">
                <label htmlFor="pk_number" className={labelClass}>
                  Nomor PK
                </label>
                <input
                  id="pk_number"
                  name="pk_number"
                  type="text"
                  value={pkNumber}
                  onChange={(event) => setPkNumber(event.target.value)}
                  placeholder="PK/HI/26/1096"
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-1">
                <label htmlFor="rft_tr_job" className={labelClass}>
                  RFT / TR / Job
                </label>
                <input
                  id="rft_tr_job"
                  name="rft_tr_job"
                  type="text"
                  value={rftTrJob}
                  onChange={(event) => setRftTrJob(event.target.value)}
                  placeholder="RFT-001"
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-1">
                <label htmlFor="booking_date" className={labelClass}>
                  Tanggal Kebutuhan{' '}
                  {isBooking && <span className="text-red-600">*</span>}
                </label>
                <input
                  id="booking_date"
                  name="booking_date"
                  type="date"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required={isBooking}
                  disabled={saving || !isBooking}
                  className={inputClass}
                />
              </div>
            </div>

            <p className="mt-2 text-[12px] text-slate-500">
              {isBooking
                ? 'Nomor PK / RFT boleh dikosongkan dulu untuk booking, bisa diisi belakangan saat sudah final.'
                : 'Isi minimal salah satu: Nomor PK atau RFT/TR/Job.'}
            </p>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={isBooking}
                onChange={(event) => setIsBooking(event.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 accent-[#082868]"
              />
              <span>
                <span className="block text-[13px] font-semibold text-slate-900">
                  Ini booking (kebutuhan di masa depan)
                </span>
                <span className="block text-[12px] text-slate-500">
                  Order belum langsung jalan. Operational cek dulu apakah MTU
                  mumpuni untuk tanggal kebutuhan ini, sebelum diproses seperti
                  order biasa.
                </span>
              </span>
            </label>
          </FormSection>

          <FormSection number={2} title="Trip & Lokasi">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <label htmlFor="trip" className={labelClass}>
                  Trip <span className="text-red-600">*</span>
                </label>
                <input
                  id="trip"
                  name="trip"
                  type="text"
                  value={trip}
                  onChange={(event) => setTrip(event.target.value)}
                  placeholder="BSD - ONWJ"
                  required
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="bawa_ra" className={labelClass}>
                  Bawa RA
                </label>
                <select
                  id="bawa_ra"
                  name="bawa_ra"
                  value={bawaRa}
                  onChange={(event) => setBawaRa(event.target.value)}
                  disabled={saving}
                  className={inputClass}
                >
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <LocationPicker
                id="origin_fence"
                label="Lokasi Muat"
                type="loading"
                fences={fences}
                value={originId}
                onChange={(id) => pickLocation('origin', id)}
                onCreated={addFence}
                disabled={saving}
                hint="Jam tiba & selesai muat dicatat otomatis dari GPS."
              />
              <LocationPicker
                id="destination_fence"
                label="Lokasi Bongkar"
                type="unloading"
                fences={fences}
                value={destinationId}
                onChange={(id) => pickLocation('destination', id)}
                onCreated={addFence}
                disabled={saving}
                hint="Jam tiba & selesai bongkar dicatat otomatis dari GPS."
              />
            </div>
          </FormSection>

          <FormSection
            number={3}
            title="Kebutuhan Kendaraan"
            aside={
              <span className="text-[12.5px] font-semibold tabular-nums text-slate-600">
                Total {totalQuantity} unit
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-[13px]">
                <thead>
                  <tr>
                    <th className="w-10 px-2 text-left">#</th>
                    <th className="px-2 text-left">
                      Jenis Kendaraan <span className="text-red-600">*</span>
                    </th>
                    <th className="w-24 px-2 text-right">Jumlah</th>
                    <th className="w-12 px-2" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((requirement, index) => (
                    <tr key={requirement.id} className="hover:!bg-transparent">
                      <td className="px-2 align-middle tabular-nums text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-2">
                        <VehicleTypeAutocomplete
                          value={requirement.vehicle_type}
                          onChange={(value) =>
                            updateVehicleType(requirement.id, value)
                          }
                          disabled={saving}
                        />
                      </td>
                      <td className="px-2">
                        <input
                          type="number"
                          min="1"
                          aria-label={`Jumlah kendaraan ${index + 1}`}
                          value={requirement.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              requirement.id,
                              Number(event.target.value)
                            )
                          }
                          disabled={saving}
                          className={`${inputClass} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRequirement(requirement.id)}
                          disabled={requirements.length === 1 || saving}
                          aria-label={`Hapus baris ${index + 1}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addRequirement}
              disabled={saving}
              className="btn btn-secondary mt-3 h-8"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Tambah jenis kendaraan
            </button>
          </FormSection>

          <FormSection number={4} title="Instruksi">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="instruction" className={labelClass}>
                  Instruksi
                </label>
                <textarea
                  id="instruction"
                  name="instruction"
                  rows={2}
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder="Tolong disiapkan untuk muat besok."
                  disabled={saving}
                  className={textareaClass}
                />
              </div>

              <div>
                <label htmlFor="notes" className={labelClass}>
                  Catatan Tambahan
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Catatan tambahan jika diperlukan..."
                  disabled={saving}
                  className={textareaClass}
                />
              </div>
            </div>
          </FormSection>
        </div>

        {/* ===== KANAN: RINGKASAN ===== */}
        <aside className="space-y-4 lg:sticky lg:top-[68px]">
          <div className="panel overflow-hidden">
            <div className="panel-header">
              <p className="panel-title">Ringkasan</p>
              {isBooking && (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                  Booking
                </span>
              )}
            </div>

            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="text-[12px] font-medium text-slate-500">Total unit</p>
              <p className="mt-0.5 text-[28px] font-bold leading-none tabular-nums text-slate-900">
                {totalQuantity}
              </p>
              {filledRequirements.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[12.5px] text-slate-600">
                  {filledRequirements.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="truncate">{item.vehicle_type}</span>
                      <span className="shrink-0 tabular-nums">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-3 text-[12.5px]">
              <SummaryRow label="Customer" value={customer} />
              <SummaryRow label="Nomor PK" value={pkNumber} />
              <SummaryRow label="RFT/TR/Job" value={rftTrJob} />
              <SummaryRow label="Trip" value={trip} />
              <SummaryRow label="Lokasi Muat" value={originFence?.name || ''} />
              <SummaryRow label="Lokasi Bongkar" value={destinationFence?.name || ''} />
              <SummaryRow label="Bawa RA" value={bawaRa} />
              {isBooking && (
                <SummaryRow
                  label="Kebutuhan"
                  value={
                    bookingDate
                      ? new Date(`${bookingDate}T00:00:00+07:00`).toLocaleDateString(
                          'id-ID',
                          { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }
                        )
                      : ''
                  }
                />
              )}
            </dl>

            <ul className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-[12.5px]">
              {checks.map((check) => (
                <li
                  key={check.label}
                  className={`flex items-center gap-2 ${
                    check.ok ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {check.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>

            <div className="flex gap-2 border-t border-[var(--border)] bg-slate-50 px-4 py-3">
              <Link href="/marketing/orders" className="btn btn-secondary flex-1">
                Batal
              </Link>
              <button
                type="submit"
                disabled={
                  hasInvalidRequirement ||
                  saving ||
                  (isBooking && !bookingDate)
                }
                className="btn btn-primary flex-[2]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving
                  ? 'Menyimpan...'
                  : isBooking
                  ? 'Simpan Booking'
                  : 'Simpan Order'}
              </button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-header">
              <p className="panel-title flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Order terakhir customer
              </p>
              {recentLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              )}
            </div>

            {!customer.trim() ? (
              <p className="px-4 py-3 text-[12.5px] text-slate-500">
                Pilih customer untuk melihat order sebelumnya.
              </p>
            ) : recentOrders.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-slate-500">
                {recentLoading || recentFor !== customer.trim()
                  ? 'Mencari order sebelumnya...'
                  : 'Belum ada order untuk customer ini.'}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/marketing/orders/${order.id}`}
                      className="block px-4 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-slate-900">
                          {order.pk_number || order.rft_tr_job || 'Tanpa PK'}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-slate-500">
                        {new Date(order.created_at).toLocaleDateString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {' · '}
                        {order.quantity ?? 0} unit
                        {order.trip ? ` · ${order.trip}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </form>
    </div>
  )
}

function FormSection({
  number,
  title,
  aside,
  children,
}: {
  number: number
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#082868] text-[11px] font-bold text-white">
            {number}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const text = value.trim()
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate ${text ? 'font-medium text-slate-900' : 'text-slate-400'}`}>
        {text || '—'}
      </dd>
    </>
  )
}
