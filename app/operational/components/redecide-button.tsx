'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { RotateCcw, Loader2 } from 'lucide-react'

type RedecideButtonProps = {
  orderId: string
}

export default function RedecideButton({ orderId }: RedecideButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  async function handleClick() {
    const confirmed = await confirm({
      title: 'Putuskan Ulang?',
      message:
        'Keputusan unit sebelumnya akan dihapus dan order kembali ke status menunggu keputusan. Lanjutkan?',
      confirmLabel: 'Ya, Putuskan Ulang',
    })

    if (!confirmed) return

    setLoading(true)

    try {
      const { error, data } = await supabase
        .from('orders')
        .update({
          status: 'waiting_unit',
          unit_decision: null,
          decision_note: null,
          decided_by: null,
          decided_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .in('unit_decision', ['partial', 'unavailable'])
        .select('id')

      if (error) {
        console.error('REDECIDE ERROR:', error)
        toast.error('Gagal Reset Keputusan', error.message)
        return
      }

      if (!data || data.length === 0) {
        toast.error(
          'Tidak Bisa Reset',
          'Order ini sudah berubah (mungkin diproses user lain). Silakan refresh halaman.'
        )
        router.refresh()
        return
      }

      toast.success(
        'Keputusan Direset',
        'Silakan tentukan ulang ketersediaan unit.'
      )

      router.refresh()
    } catch (error) {
      console.error('REDECIDE ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal mereset keputusan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Putuskan Ulang
    </button>
  )
}