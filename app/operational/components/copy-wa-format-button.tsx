'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { ClipboardCopy, X, Loader2, Copy } from 'lucide-react'

const dayNames = [
  'MINGGU',
  'SENIN',
  'SELASA',
  'RABU',
  'KAMIS',
  'JUMAT',
  'SABTU',
]

const monthNamesEn = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

function formatPhone(phone: string | null) {
  if (!phone) return '-'
  const trimmed = phone.trim()
  if (trimmed.startsWith('0')) {
    return `+62${trimmed.slice(1)}`
  }
  if (trimmed.startsWith('+62')) {
    return trimmed
  }
  if (trimmed.startsWith('62')) {
    return `+${trimmed}`
  }
  return trimmed
}

type InspectionResult = {
  result: string | null
}

type TruckRow = {
  vehicle_type: string
  plate_number: string | null
  driver_name: string | null
  driver_phone: string | null
  source: string | null
  inspections: InspectionResult | InspectionResult[] | null
}

type OrderRow = {
  id: string
  customer: string
  pk_number: string | null
  rft_tr_job: string | null
  trip: string | null
  instruction: string | null
  order_requirements: { vehicle_type: string; quantity: number }[]
  order_trucks: TruckRow[]
}

function resultLabel(result: string | null | undefined) {
  if (result === 'passed') return 'Passed'
  if (result === 'failed') return 'Failed'
  if (result === 'on_going') return 'On Going'
  return null
}

function buildMessage(dateLabel: string, orders: OrderRow[]) {
  const lines: string[] = [`PERMINTAAN KENDARAAN ${dateLabel}`, '']

  for (const order of orders) {
    lines.push(order.customer.toUpperCase())
    lines.push(order.rft_tr_job || '-')
    lines.push(`Nomor PK :  ${order.pk_number || '-'}`)
    lines.push('Tipe dan jumlah truck yang di order : ')

    for (const requirement of order.order_requirements || []) {
      lines.push(`${requirement.quantity} ${requirement.vehicle_type}`)
    }

    lines.push(`Trip : ${order.trip || '-'}`)
    lines.push(`Status : ${order.instruction || '-'}`)

    const filledTrucks = (order.order_trucks || []).filter(
      (truck) => truck.plate_number && truck.driver_name
    )

    lines.push('Detail truck : ')

    if (filledTrucks.length > 0) {
      for (const truck of filledTrucks) {
        lines.push(
          `${truck.vehicle_type}/${truck.plate_number}/${truck.driver_name}/${formatPhone(
            truck.driver_phone
          )}`
        )
      }
    }

    const internalTrucksWithInspection = filledTrucks
      .filter((truck) => truck.source === 'internal')
      .map((truck) => {
        const inspection = Array.isArray(truck.inspections)
          ? truck.inspections[0]
          : truck.inspections

        return {
          driverName: truck.driver_name,
          result: resultLabel(inspection?.result),
        }
      })
      .filter((item) => item.result)

    if (internalTrucksWithInspection.length === 1) {
      lines.push(`Pre trip inspeksi : ${internalTrucksWithInspection[0].result}`)
    } else if (internalTrucksWithInspection.length > 1) {
      lines.push('Pre trip inspeksi : ')
      for (const item of internalTrucksWithInspection) {
        lines.push(`${item.driverName} ${item.result?.toLowerCase()}`)
      }
    } else {
      lines.push('Pre trip inspeksi : ')
    }

    lines.push('')
  }

  return lines.join('\n').trim()
}

export default function CopyWaFormatButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [message, setMessage] = useState('')
  const toast = useToast()

  async function handleGenerate() {
    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()

      const startOfDay = new Date(`${date}T00:00:00+07:00`)
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer,
          pk_number,
          rft_tr_job,
          trip,
          instruction,
          created_at,
          order_requirements (
            vehicle_type,
            quantity
          ),
          order_trucks (
            vehicle_type,
            plate_number,
            driver_name,
            driver_phone,
            source,
            status,
            inspections (
              result
            )
          )
        `)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('GENERATE WA FORMAT ERROR:', error)
        toast.error('Gagal Mengambil Data', error.message)
        return
      }

      const orders = ((data || []) as unknown as OrderRow[]).map((order) => ({
        ...order,
        order_trucks: (order.order_trucks || []).filter(
          (truck: any) => truck.status !== 'cancelled'
        ),
      }))

      const dayLabel = dayNames[startOfDay.getDay()]
      const monthLabel = monthNamesEn[startOfDay.getMonth()]
      const dateLabel = `${dayLabel}, ${startOfDay.getDate()} ${monthLabel} ${startOfDay.getFullYear()}`

      const generated = buildMessage(dateLabel, orders)

      setMessage(
        orders.length
          ? generated
          : `PERMINTAAN KENDARAAN ${dateLabel}\n\nTidak ada order pada tanggal ini.`
      )
    } catch (error) {
      console.error('GENERATE WA FORMAT ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal membuat format WA.')
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    handleGenerate()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Tersalin', 'Format WA berhasil disalin ke clipboard.')
    } catch (error) {
      console.error('COPY ERROR:', error)
      toast.error('Gagal Menyalin', 'Coba salin manual dari kotak teks.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-[#01236A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#01236A] shadow-sm transition hover:bg-[#01236A]/5"
      >
        <ClipboardCopy className="h-4 w-4" />
        Salin Format WA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">
                Permintaan Kendaraan — Format WA
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-3">
              <label className="text-xs font-semibold text-gray-500">
                Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="ml-auto rounded-lg bg-[#01236A] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#01236A]/85 disabled:opacity-50"
              >
                {loading ? 'Memuat...' : 'Muat Ulang'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyusun data...
                </div>
              ) : (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={16}
                  className="w-full resize-none whitespace-pre-wrap rounded-lg border border-gray-200 px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
                />
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={handleCopy}
                disabled={loading || !message}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Salin ke Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}