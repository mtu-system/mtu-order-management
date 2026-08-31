'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { ShieldCheck, Send, Loader2, Hash, Clock } from 'lucide-react'
import { logUnitHistory } from '@/lib/history'

type UnitProcessingProps = {
  truck: {
    id: string
    order_id: string
    vehicle_type: string
    no_buntut: string | null
    plate_number: string | null
    driver_name: string | null
    driver_phone: string | null
    status: string
    surat_jalan_distributed: boolean
    uang_jalan_distributed: boolean
  }
}

const noBuntutTypes = ['Trailer', 'Lowbed', 'Dolly']

function hasNoBuntut(vehicleType: string) {
  return noBuntutTypes.some(
    (type) => type.toLowerCase() === vehicleType.toLowerCase()
  )
}

export default function UnitProcessing({ truck }: UnitProcessingProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [noBuntut, setNoBuntut] = useState(truck.no_buntut || '')
  const [saving, setSaving] = useState(false)

  const needNoBuntut = hasNoBuntut(truck.vehicle_type)

  async function handleReadyToDepart() {
    if (saving) return

    if (needNoBuntut && !noBuntut.trim()) {
      toast.error(
        'Data Belum Lengkap',
        'No. Buntut wajib diisi untuk unit ini.'
      )
      return
    }

    if (truck.status !== 'ready_loading') {
      toast.error('Unit Belum Siap', 'Unit belum berstatus Ready Loading.')
      return
    }

    const confirmed = await confirm({
      title: 'Tandai Ready to Depart?',
      message:
        'Pastikan No. Buntut sudah benar dan Surat Jalan serta Uang Jalan sudah dibagikan.',
      confirmLabel: 'Ya, Tandai',
    })

    if (!confirmed) return

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Sesi Login Tidak Ditemukan', 'Silakan login ulang.')
        return
      }

      const { error } = await supabase
        .from('order_trucks')
        .update({
          no_buntut: needNoBuntut ? noBuntut.trim() : null,
          surat_jalan_distributed: true,
          surat_jalan_distributed_by: user.id,
          surat_jalan_distributed_at: new Date().toISOString(),
          uang_jalan_distributed: true,
          uang_jalan_distributed_by: user.id,
          uang_jalan_distributed_at: new Date().toISOString(),
          status: 'ready_to_depart',
          departure_ready_by: user.id,
          departure_ready_at: new Date().toISOString(),
        })
        .eq('id', truck.id)
        .eq('status', 'ready_loading')

           if (error) {
        console.error('PROCESS UNIT ERROR:', error)
        toast.error('Gagal Menyimpan', error.message)
        return
      }

      await logUnitHistory({
        truckId: truck.id,
        orderId: truck.order_id,
        action: 'ready_to_depart',
        fieldName: 'status',
        oldValue: 'ready_loading',
        newValue: 'ready_to_depart',
        reason: 'Surat Jalan dan Uang Jalan sudah dibagikan.',
        changedBy: user.id,
      })

      const { data: trucks, error: trucksError } = await supabase
        .from('order_trucks')
        .select('status, source')
        .eq('order_id', truck.order_id)

      if (trucksError) {
        console.error('CHECK ORDER TRUCKS ERROR:', trucksError)
        toast.error('Gagal Memeriksa Status Order', trucksError.message)
        return
      }

      const activeInternalTrucks = (trucks || []).filter(
        (item) =>
          item.source === 'internal' &&
          item.status !== 'cancelled' &&
          item.status !== 'departed' &&
          item.status !== 'finished'
      )

      const allReadyToDepart =
        activeInternalTrucks.length > 0 &&
        activeInternalTrucks.every(
          (item) => item.status === 'ready_to_depart'
        )

      if (allReadyToDepart) {
        const { error: orderStatusError } = await supabase
          .from('orders')
          .update({ status: 'ready_to_depart' })
          .eq('id', truck.order_id)

        if (orderStatusError) {
          console.error('UPDATE ORDER STATUS ERROR:', orderStatusError)
          toast.error('Gagal Memperbarui Status Order', orderStatusError.message)
          return
        }
      }

      toast.success(
        'Unit Berhasil Diproses',
        `${truck.vehicle_type} — Surat Jalan & Uang Jalan sudah dibagikan, status Ready to Depart.`
      )

      router.refresh()
    } catch (error) {
      console.error('UNIT PROCESSING ERROR:', error)
      toast.error(
        'Terjadi Kesalahan',
        'Gagal memproses unit. Silakan coba lagi.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-gray-900">
            {truck.vehicle_type}
          </h3>
          <p className="flex items-center gap-1 text-xs text-gray-400">
            <Hash className="h-3 w-3" />
            {truck.id}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          HSE Passed
        </span>
      </div>

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Plat Nomor
            </p>
            <p className="mt-1.5 font-bold text-gray-900">
              {truck.plate_number || '-'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Driver
            </p>
            <p className="mt-1.5 font-bold text-gray-900">
              {truck.driver_name || '-'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              No. HP
            </p>
            <p className="mt-1.5 font-bold text-gray-900">
              {truck.driver_phone || '-'}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5">
          {needNoBuntut ? (
            <>
              <label className="mb-2 block text-sm font-bold text-gray-900">
                No. Buntut
              </label>
              <input
                type="text"
                value={noBuntut}
                onChange={(event) => setNoBuntut(event.target.value)}
                placeholder="Contoh: 40-21"
                disabled={saving}
                className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10"
              />
            </>
          ) : (
            <div>
              <p className="text-sm font-bold text-gray-900">No. Buntut</p>
              <p className="mt-1 text-sm text-gray-500">
                Tidak diperlukan untuk jenis kendaraan ini.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5">
          <h4 className="mb-2 font-bold text-gray-900">
            Persiapan Keberangkatan
          </h4>
          <p className="mb-4 text-sm text-gray-500">
            Surat Jalan dan Uang Jalan akan ditandai sudah dibagikan
            sekaligus saat unit ditandai Ready to Depart.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Surat Jalan
                </p>
                <p className="text-xs text-gray-500">
                  Akan dibagikan kepada driver
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                <Clock className="h-3 w-3" />
                Diproses
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Uang Jalan
                </p>
                <p className="text-xs text-gray-500">
                  Akan dibagikan kepada driver
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                <Clock className="h-3 w-3" />
                Diproses
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReadyToDepart}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#01236A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {saving ? 'Memproses Unit...' : 'Simpan & Tandai Ready to Depart'}
          </button>
        </div>
      </div>
    </div>
  )
}