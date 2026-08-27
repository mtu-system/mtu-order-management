'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ShieldCheck,
  Send,
  Loader2,
  Hash,
  Clock,
} from 'lucide-react'

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

const noBuntutTypes = [
  'Trailer',
  'Lowbed',
  'Dolly',
]

function hasNoBuntut(vehicleType: string) {
  return noBuntutTypes.some(
    (type) =>
      type.toLowerCase() === vehicleType.toLowerCase()
  )
}

export default function UnitProcessing({
  truck,
}: UnitProcessingProps) {
  const router = useRouter()
  const supabase = createClient()

  const [noBuntut, setNoBuntut] = useState(
    truck.no_buntut || ''
  )

  const [saving, setSaving] = useState(false)

  const needNoBuntut = hasNoBuntut(
    truck.vehicle_type
  )

  async function handleReadyToDepart() {
    if (saving) return

    // ==========================================
    // VALIDASI NO BUNTUT
    // ==========================================

    if (
      needNoBuntut &&
      !noBuntut.trim()
    ) {
      alert(
        'No. Buntut wajib diisi untuk unit ini.'
      )
      return
    }

    // ==========================================
    // PASTIKAN STATUS UNIT
    // ==========================================

    if (truck.status !== 'ready_loading') {
      alert(
        'Unit belum berstatus Ready Loading.'
      )
      return
    }

    // ==========================================
    // KONFIRMASI
    // ==========================================

    const confirmed = window.confirm(
      'Pastikan No. Buntut sudah benar dan Surat Jalan serta Uang Jalan sudah dibagikan. Tandai unit ini sebagai Ready to Depart?'
    )

    if (!confirmed) return

    setSaving(true)

    try {
      // ==========================================
      // CEK USER
      // ==========================================

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert(
          'Session login tidak ditemukan.'
        )
        return
      }

      // ==========================================
      // SATU UPDATE UNTUK SEMUANYA
      // ==========================================

      const { error } = await supabase
        .from('order_trucks')
        .update({
          // No buntut
          no_buntut: needNoBuntut
            ? noBuntut.trim()
            : null,

          // Surat Jalan
          surat_jalan_distributed: true,
          surat_jalan_distributed_by: user.id,
          surat_jalan_distributed_at:
            new Date().toISOString(),

          // Uang Jalan
          uang_jalan_distributed: true,
          uang_jalan_distributed_by: user.id,
          uang_jalan_distributed_at:
            new Date().toISOString(),

          // Siap Jalan
          status: 'ready_to_depart',
          departure_ready_by: user.id,
          departure_ready_at:
            new Date().toISOString(),
        })
        .eq('id', truck.id)
        .eq('status', 'ready_loading')

      if (error) {
        console.error(
          'PROCESS UNIT ERROR:',
          error
        )

        alert(error.message)
        return
      }

      // ==========================================
// UPDATE STATUS ORDER
// ==========================================

const { data: trucks, error: trucksError } =
  await supabase
    .from('order_trucks')
    .select('status')
    .eq('order_id', truck.order_id)

if (trucksError) {
  console.error(
    'CHECK ORDER TRUCKS ERROR:',
    trucksError
  )

  alert(trucksError.message)
  return
}

const activeTrucks = (trucks || []).filter(
  (item) =>
    item.status !== 'cancelled' &&
    item.status !== 'departed' &&
    item.status !== 'finished'
)

const allReadyToDepart =
  activeTrucks.length > 0 &&
  activeTrucks.every(
    (item) =>
      item.status === 'ready_to_depart'
  )

if (allReadyToDepart) {
  const { error: orderStatusError } =
    await supabase
      .from('orders')
      .update({
        status: 'ready_to_depart',
      })
      .eq('id', truck.order_id)

  if (orderStatusError) {
    console.error(
      'UPDATE ORDER STATUS ERROR:',
      orderStatusError
    )

    alert(orderStatusError.message)
    return
  }
}

      // ==========================================
      // SUCCESS
      // ==========================================

      alert(
        `Unit ${truck.vehicle_type} berhasil diproses.\n\n` +
        `Surat Jalan: Sudah Dibagikan\n` +
        `Uang Jalan: Sudah Dibagikan\n` +
        `Status: Ready to Depart`
      )

      router.refresh()

    } catch (error) {
      console.error(
        'UNIT PROCESSING ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat memproses unit.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4">

        <div>
          <h3 className="text-lg font-semibold tracking-tight text-gray-900">
            {truck.vehicle_type}
          </h3>

          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Hash className="h-3 w-3" />
            {truck.id}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          HSE Passed
        </span>

      </div>

      <div className="p-6">

        {/* DETAIL UNIT */}
        <div className="grid gap-4 md:grid-cols-3">

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Plat Nomor
            </p>

            <p className="mt-1.5 font-medium text-gray-900">
              {truck.plate_number || '-'}
            </p>
          </div>


          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Driver
            </p>

            <p className="mt-1.5 font-medium text-gray-900">
              {truck.driver_name || '-'}
            </p>
          </div>


          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              No. HP
            </p>

            <p className="mt-1.5 font-medium text-gray-900">
              {truck.driver_phone || '-'}
            </p>
          </div>

        </div>


        {/* NO BUNTUT */}
        <div className="mt-6 border-t border-gray-100 pt-5">

          {needNoBuntut ? (
            <>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                No. Buntut
              </label>

              <input
                type="text"
                value={noBuntut}
                onChange={(event) =>
                  setNoBuntut(event.target.value)
                }
                placeholder="Contoh: 40-21"
                disabled={saving}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-900">
                No. Buntut
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Tidak diperlukan untuk jenis kendaraan ini.
              </p>
            </div>
          )}

        </div>


        {/* PERSIAPAN KEBERANGKATAN */}
        <div className="mt-6 border-t border-gray-100 pt-5">

          <h4 className="mb-2 font-semibold text-gray-900">
            Persiapan Keberangkatan
          </h4>

          <p className="mb-4 text-sm text-gray-500">
            Surat Jalan dan Uang Jalan akan ditandai
            sudah dibagikan sekaligus saat unit
            ditandai Ready to Depart.
          </p>


          <div className="space-y-3">

            {/* SURAT JALAN */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">

              <div>
                <p className="text-sm font-medium text-gray-900">
                  Surat Jalan
                </p>

                <p className="text-xs text-gray-500">
                  Akan dibagikan kepada driver
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <Clock className="h-3 w-3" />
                Diproses
              </span>

            </div>


            {/* UANG JALAN */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">

              <div>
                <p className="text-sm font-medium text-gray-900">
                  Uang Jalan
                </p>

                <p className="text-xs text-gray-500">
                  Akan dibagikan kepada driver
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <Clock className="h-3 w-3" />
                Diproses
              </span>

            </div>

          </div>


          {/* FINAL BUTTON */}
          <button
            type="button"
            onClick={handleReadyToDepart}
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {saving
              ? 'Memproses Unit...'
              : 'Simpan & Tandai Ready to Depart'}
          </button>

        </div>

      </div>

    </div>
  )
}
