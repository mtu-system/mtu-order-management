'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'

type UnitDecisionFormProps = {
  orderId: string
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
    <form
      onSubmit={handleSubmit}
      className="mt-5 space-y-5"
    >
      {/* KEPUTUSAN */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Keputusan Unit
        </label>

        <select
          value={decision}
          onChange={(event) =>
            setDecision(event.target.value)
          }
          required
          disabled={loading}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">
            Pilih keputusan
          </option>

          <option value="available">
            Unit Tersedia
          </option>

          <option value="partial">
            Sebagian Tersedia
          </option>

          <option value="vendor">
            Gunakan Vendor
          </option>

          <option value="unavailable">
            Unit Tidak Tersedia
          </option>
        </select>
      </div>

      {/* CATATAN */} 
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Catatan Keputusan
        </label>

        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          rows={4}
          disabled={loading}
          placeholder="Contoh: Trailer tersedia 2 dari 3 unit. 1 unit masih dicari."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* BUTTON */}
      <button
        type="submit"
        disabled={!decision || loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {loading
          ? 'Menyimpan...'
          : 'Simpan Keputusan'}
      </button>
    </form>
  )
}
