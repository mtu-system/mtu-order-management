'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'

type UnitDecisionFormProps = {
  orderId: string
}

const decisionOptions = [
  {
    value: 'available',
    label: 'Unit Tersedia',
    description: 'Seluruh kebutuhan unit tersedia dan siap dialokasikan.',
    icon: CheckCircle2,
    color: 'emerald',
  },
  {
    value: 'partial',
    label: 'Sebagian Tersedia',
    description: 'Sebagian unit tersedia, sisanya masih dicari.',
    icon: AlertCircle,
    color: 'amber',
  },
  {
    value: 'unavailable',
    label: 'Unit Tidak Tersedia',
    description: 'Unit tidak tersedia, dikembalikan ke Marketing.',
    icon: XCircle,
    color: 'red',
  },
] as const

type ColorClass = { selected: string; icon: string; iconBg: string }

const colorClasses: Record<string, ColorClass> = {
  emerald: {
    selected: 'border-emerald-500 bg-emerald-50',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  amber: {
    selected: 'border-amber-500 bg-amber-50',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  violet: {
    selected: 'border-violet-500 bg-violet-50',
    icon: 'text-violet-600',
    iconBg: 'bg-violet-100',
  },
  red: {
    selected: 'border-red-500 bg-red-50',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
}

export default function UnitDecisionForm({
  orderId,
}: UnitDecisionFormProps) {
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!decision || loading) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const statusMap = {
        available: 'waiting_unit',
        partial: 'waiting_unit',
        vendor: 'vendor_process',
        unavailable: 'pending',
      } as const

      const nextStatus =
        statusMap[
          decision as keyof typeof statusMap
        ]

      if (!nextStatus) {
        alert('Keputusan tidak valid.')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({
          unit_decision: decision,
          decision_note: note.trim() || null,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          status: nextStatus,
        })
        .eq('id', orderId)

      if (error) {
        console.error('UPDATE DECISION ERROR:', error)
        alert(error.message)
        return
      }

      alert('Keputusan berhasil disimpan.')

      router.refresh()
    } catch (error) {
      console.error('DECISION ERROR:', error)
      alert('Terjadi kesalahan saat menyimpan keputusan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-6">
      {/* PILIHAN KEPUTUSAN */}
      <div>
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Keputusan Unit
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {decisionOptions.map((option) => {
            const Icon = option.icon
            const isSelected = decision === option.value
            const colors = colorClasses[option.color]

            return (
              <button
                key={option.value}
                type="button"
                disabled={loading}
                onClick={() => setDecision(option.value)}
                className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? colors.selected
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colors.iconBg}`}
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

      {/* CATATAN */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Catatan Keputusan
        </label>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          disabled={loading}
          placeholder="Contoh: Trailer tersedia 2 dari 3 unit. 1 unit masih dicari."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
        />
      </div>

      {/* BUTTON */}
      <button
        type="submit"
        disabled={!decision || loading}
        className="inline-flex items-center gap-2 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {loading ? 'Menyimpan...' : 'Simpan Keputusan'}
      </button>
    </form>
  )
}