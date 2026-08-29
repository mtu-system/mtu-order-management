'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/toast-provider'
import {
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
} from 'lucide-react'
import { logUnitHistory } from '@/lib/history'

type Inspection = {
  result: string
  notes: string | null
  inspected_by: string
  inspected_at: string
}

type InspectionFormProps = {
  truckId: string
  orderId: string
  initialInspection: Inspection | null
}

const resultOptions = [
  {
    value: 'passed',
    label: 'Passed',
    description: 'Unit lolos pemeriksaan, siap loading.',
    icon: CheckCircle2,
    color: 'emerald',
  },
  {
    value: 'failed',
    label: 'Failed',
    description: 'Unit tidak lolos pemeriksaan.',
    icon: XCircle,
    color: 'red',
  },
  {
    value: 'on_going',
    label: 'On Going',
    description: 'Pemeriksaan masih berlangsung.',
    icon: Clock3,
    color: 'amber',
  },
] as const

type ColorClass = { selected: string; icon: string; iconBg: string }

const colorClasses: Record<string, ColorClass> = {
  emerald: {
    selected: 'border-emerald-500 bg-emerald-50',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  red: {
    selected: 'border-red-500 bg-red-50',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
  amber: {
    selected: 'border-amber-500 bg-amber-50',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
}

function formatResultLabel(result: string | null | undefined) {
  if (result === 'passed') return 'Passed'
  if (result === 'failed') return 'Failed'
  if (result === 'on_going') return 'On Going'
  return 'Belum Diperiksa'
}

export default function InspectionForm({
  truckId,
  orderId,
  initialInspection,
}: InspectionFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [result, setResult] = useState(initialInspection?.result || '')
  const [notes, setNotes] = useState(initialInspection?.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    if (!result) {
      toast.error('Data Belum Lengkap', 'Hasil pemeriksaan wajib dipilih.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
        return
      }

      const { error: inspectionError } = await supabase
        .from('inspections')
        .upsert(
          {
            truck_id: truckId,
            result,
            notes: notes.trim() || null,
            inspected_by: user.id,
            inspected_at: new Date().toISOString(),
          },
          { onConflict: 'truck_id' }
        )

      if (inspectionError) {
        console.error('SAVE INSPECTION ERROR:', inspectionError)
        toast.error('Gagal Menyimpan Pemeriksaan', inspectionError.message)
        return
      }

      let truckStatus = 'waiting_hse'

      if (result === 'passed') {
        truckStatus = 'ready_loading'
      } else if (result === 'failed') {
        truckStatus = 'failed'
      } else if (result === 'on_going') {
        truckStatus = 'inspection'
      }

      const { error: truckStatusError } = await supabase
        .from('order_trucks')
        .update({ status: truckStatus })
        .eq('id', truckId)

      if (truckStatusError) {
        console.error('UPDATE TRUCK STATUS ERROR:', truckStatusError)
        toast.error('Gagal Memperbarui Status Unit', truckStatusError.message)
        return
      }

      await logUnitHistory({
        truckId,
        orderId,
        action: 'hse_inspection',
        fieldName: 'status',
        oldValue: formatResultLabel(initialInspection?.result),
        newValue: formatResultLabel(result),
        reason: notes.trim() || 'Tidak ada catatan dari HSE.',
        changedBy: user.id,
      })

      if (result === 'passed') {
        const { data: trucks, error: trucksError } = await supabase
          .from('order_trucks')
          .select('status, source')
          .eq('order_id', orderId)

        if (trucksError) {
          console.error('CHECK ORDER TRUCKS ERROR:', trucksError)
          toast.error('Gagal Memeriksa Status Order', trucksError.message)
          return
        }

        const activeTrucks = (trucks || []).filter(
          (truck) =>
            truck.source === 'internal' &&
            truck.status !== 'cancelled' &&
            truck.status !== 'departed' &&
            truck.status !== 'finished'
        )

        const allPassed =
          activeTrucks.length > 0 &&
          activeTrucks.every((truck) => truck.status === 'ready_loading')

        if (allPassed) {
          const { error: orderStatusError } = await supabase
            .from('orders')
            .update({ status: 'ready_loading' })
            .eq('id', orderId)

          if (orderStatusError) {
            console.error('UPDATE ORDER STATUS ERROR:', orderStatusError)
            toast.error(
              'Gagal Memperbarui Status Order',
              orderStatusError.message
            )
            return
          }
        }
      }

      const resultLabel = formatResultLabel(result)

      toast.success(
        'Pemeriksaan Tersimpan',
        `Hasil "${resultLabel}" berhasil disimpan untuk unit ini.`
      )

      router.refresh()
    } catch (error) {
      console.error('INSPECTION ERROR:', error)
      toast.error(
        'Terjadi Kesalahan',
        'Gagal menyimpan pemeriksaan. Silakan coba lagi.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-6">
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Hasil Pemeriksaan
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {resultOptions.map((option) => {
            const Icon = option.icon
            const isSelected = result === option.value
            const colors = colorClasses[option.color]

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => setResult(option.value)}
                className={`flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? colors.selected
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${colors.iconBg}`}
                >
                  <Icon className={`h-4.5 w-4.5 ${colors.icon}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {option.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Catatan Pemeriksaan
        </label>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          disabled={saving}
          placeholder="Catatan hasil pemeriksaan..."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !result}
        className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? 'Menyimpan...' : 'Simpan Pemeriksaan'}
      </button>
    </form>
  )
}