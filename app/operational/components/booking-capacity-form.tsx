'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { logOrderHistory } from '@/lib/history'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Save,
  Loader2,
} from 'lucide-react'

type Requirement = {
  id: number | string
  vehicle_type: string
  quantity: number
}

type BookingCapacityFormProps = {
  orderId: string
  requirements: Requirement[]
}

type Breakdown = {
  vehicle_type: string
  internal: number
  vendor: number
  unavailable: number
}

const decisionOptions = [
  {
    value: 'available',
    label: 'Mumpuni',
    description: 'MTU bisa cover seluruh kebutuhan (internal + vendor).',
    icon: CheckCircle2,
    color: 'emerald',
  },
  {
    value: 'partial',
    label: 'Sebagian Mumpuni',
    description: 'Cuma bisa cover sebagian dari kebutuhan booking ini.',
    icon: AlertCircle,
    color: 'amber',
  },
  {
    value: 'unavailable',
    label: 'Tidak Mumpuni',
    description: 'Tidak bisa cover kebutuhan ini sama sekali.',
    icon: XCircle,
    color: 'red',
  },
] as const

const colorClasses: Record<
  string,
  { selected: string; icon: string; iconBg: string }
> = {
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
  red: {
    selected: 'border-red-500 bg-red-50',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
}

export default function BookingCapacityForm({
  orderId,
  requirements,
}: BookingCapacityFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const [breakdown, setBreakdown] = useState<Breakdown[]>(
    requirements.map((requirement) => ({
      vehicle_type: requirement.vehicle_type,
      internal: 0,
      vendor: 0,
      unavailable: requirement.quantity,
    }))
  )

  const needsBreakdown = decision === 'available' || decision === 'partial'

  function updateBreakdown(
    index: number,
    field: 'internal' | 'vendor' | 'unavailable',
    value: string
  ) {
    const numberValue = value === '' ? 0 : Number(value)

    setBreakdown((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                Number.isFinite(numberValue) && numberValue >= 0
                  ? Math.floor(numberValue)
                  : 0,
            }
          : item
      )
    )
  }

  function getRequirementQuantity(vehicleType: string) {
    return (
      requirements.find((item) => item.vehicle_type === vehicleType)
        ?.quantity || 0
    )
  }

  function isValidRow(row: Breakdown) {
    const required = getRequirementQuantity(row.vehicle_type)
    return row.internal + row.vendor + row.unavailable === required
  }

  const breakdownValid = breakdown.every(isValidRow)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!decision || loading) return

    if (needsBreakdown && !breakdownValid) {
      toast.error(
        'Breakdown Belum Sesuai',
        'Total internal + vendor + tidak tersedia harus sama dengan kebutuhan.'
      )
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
        return
      }

      const nextStatus =
        decision === 'unavailable' ? 'booking_rejected' : 'booking_confirmed'

      const { error, data } = await supabase
        .from('orders')
        .update({
          booking_decision: decision,
          booking_decision_note: note.trim() || null,
          booking_decided_by: user.id,
          booking_decided_at: new Date().toISOString(),
          status: nextStatus,
        })
        .eq('id', orderId)
        .eq('status', 'booking_review')
        .select('id')

      if (error) {
        console.error('BOOKING CAPACITY DECISION ERROR:', error)
        toast.error('Gagal Menyimpan Keputusan', error.message)
        return
      }

      if (!data || data.length === 0) {
        toast.error(
          'Sudah Diproses',
          'Booking ini sudah diproses (mungkin oleh user lain). Silakan refresh halaman.'
        )
        router.refresh()
        return
      }

      if (needsBreakdown) {
        const { error: logError } = await supabase
          .from('activity_logs')
          .insert({
            order_id: orderId,
            user_id: user.id,
            action: 'BOOKING_CAPACITY_CHECK',
            old_value: null,
            new_value: JSON.stringify(breakdown),
          })

        if (logError) {
          console.error('SAVE BOOKING CAPACITY LOG ERROR:', logError)
        }
      }

      try {
        await logOrderHistory({
          orderId,
          action: 'booking_capacity_check',
          fieldName: 'status',
          oldValue: 'booking_review',
          newValue: nextStatus,
          reason: note.trim() || undefined,
          changedBy: user.id,
        })
      } catch (historyError) {
        console.error('LOG BOOKING HISTORY ERROR:', historyError)
      }

      toast.success(
        'Keputusan Kapasitas Tersimpan',
        decision === 'unavailable'
          ? 'Booking ditandai tidak mumpuni, dikembalikan ke Marketing.'
          : 'Booking ditandai mumpuni, menunggu approval Marketing.'
      )

      router.refresh()
    } catch (error) {
      console.error('BOOKING CAPACITY ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal menyimpan keputusan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border-2 border-violet-200 bg-violet-50/40 p-6"
    >
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">
          Cek Kapasitas Booking
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Ini booking untuk kebutuhan di masa depan. Cukup tentukan apakah
          MTU mumpuni atau tidak — belum perlu isi detail truk (plat/driver).
          Alokasi & detail unit sesungguhnya akan diisi nanti mendekati hari
          H, setelah Marketing approve.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {needsBreakdown && (
        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Jenis Unit
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Kebutuhan
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Internal
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Vendor
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tidak Tersedia
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {breakdown.map((row, index) => {
                const required = getRequirementQuantity(row.vehicle_type)
                const total = row.internal + row.vendor + row.unavailable
                const valid = total === required

                return (
                  <tr key={row.vehicle_type}>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {row.vehicle_type}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {required}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.internal}
                        onChange={(event) =>
                          updateBreakdown(
                            index,
                            'internal',
                            event.target.value
                          )
                        }
                        disabled={loading}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.vendor}
                        onChange={(event) =>
                          updateBreakdown(index, 'vendor', event.target.value)
                        }
                        disabled={loading}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={row.unavailable}
                        onChange={(event) =>
                          updateBreakdown(
                            index,
                            'unavailable',
                            event.target.value
                          )
                        }
                        disabled={loading}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          valid
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {total} / {required}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Catatan (hasil kompromi dengan Vendor Management, dll.)
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          disabled={loading}
          placeholder="Contoh: Sudah kompromi dengan VM, internal 9 unit + vendor 6 unit siap untuk tanggal tersebut."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
        />
      </div>

      <button
        type="submit"
        disabled={!decision || loading || (needsBreakdown && !breakdownValid)}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {loading ? 'Menyimpan...' : 'Simpan Keputusan Kapasitas'}
      </button>
    </form>
  )
}
