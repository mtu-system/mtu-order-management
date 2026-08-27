'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PackageCheck, Loader2 } from 'lucide-react'

type DepartureReadyButtonProps = {
  orderId: string
}

export default function DepartureReadyButton({
  orderId,
}: DepartureReadyButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)

  async function handleReady() {
    if (saving) return

    const confirmed = window.confirm(
      'Pastikan Surat Jalan dan Uang Jalan sudah dibagikan. Tandai order ini sebagai Ready to Depart?'
    )

    if (!confirmed) return

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'ready_to_depart',
          departure_ready_by: user.id,
          departure_ready_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('status', 'ready_loading')

      if (error) {
        console.error(
          'READY TO DEPART ERROR:',
          error
        )

        alert(error.message)
        return
      }

      alert('Order berhasil ditandai sebagai Ready to Depart')

      router.push('/operational')
      router.refresh()
    } catch (error) {
      console.error(
        'DEPARTURE READY ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat menandai order sebagai Ready to Depart.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleReady}
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PackageCheck className="h-4 w-4" />
      )}
      {saving
        ? 'Menyimpan...'
        : 'Tandai Ready to Depart'}
    </button>
  )
}
