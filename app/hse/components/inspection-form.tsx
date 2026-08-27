'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

export default function InspectionForm({
  truckId,
  orderId,
  initialInspection,
}: InspectionFormProps) {
  const router = useRouter()
  const supabase = createClient()

 const [result, setResult] = useState(
  initialInspection?.result || ''
)

const [notes, setNotes] = useState(
  initialInspection?.notes || ''
)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (saving) return

    if (!result) {
      alert('Hasil pemeriksaan wajib dipilih.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      // ==========================================
      // 1. SIMPAN / UPDATE INSPECTION
      // ==========================================

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
          {
            onConflict: 'truck_id',
          }
        )

      if (inspectionError) {
        console.error(
          'SAVE INSPECTION ERROR:',
          inspectionError
        )

        alert(inspectionError.message)
        return
      }
      

      // ==========================================
      // 2. TENTUKAN STATUS UNIT
      // ==========================================

      let unitStatus = 'waiting_hse'

      if (result === 'passed') {
        unitStatus = 'ready_loading'
      } else if (result === 'failed') {
        unitStatus = 'failed'
      } else if (result === 'on_going') {
        unitStatus = 'inspection'
      }

      // ==========================================
// UPDATE STATUS UNIT
// ==========================================

let truckStatus = 'waiting_hse'

if (result === 'passed') {
  truckStatus = 'ready_loading'
} else if (result === 'failed') {
  truckStatus = 'failed'
} else if (result === 'on_going') {
  truckStatus = 'inspection'
}

// ==========================================
// 3. UPDATE STATUS UNIT
// ==========================================

const { error: truckStatusError } = await supabase
  .from('order_trucks')
  .update({
    status: truckStatus,
  })
  .eq('id', truckId)

if (truckStatusError) {
  console.error(
    'UPDATE TRUCK STATUS ERROR:',
    truckStatusError
  )

  alert(truckStatusError.message)
  return
}

// ==========================================
// 4. UPDATE STATUS ORDER
//
// HANYA UNIT INTERNAL YANG MENENTUKAN
// APAKAH ORDER SUDAH ready_loading.
// UNIT VM (source = 'vendor', status = 'vm')
// TIDAK IKUT DIHITUNG, KARENA STATUSNYA
// MEMANG TIDAK PERNAH 'ready_loading'.
// ==========================================

if (result === 'passed') {
  const { data: trucks, error: trucksError } =
    await supabase
      .from('order_trucks')
      .select('status, source')
      .eq('order_id', orderId)

  if (trucksError) {
    console.error(
      'CHECK ORDER TRUCKS ERROR:',
      trucksError
    )

    alert(trucksError.message)
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
    activeTrucks.every(
      (truck) =>
        truck.status === 'ready_loading'
    )

  if (allPassed) {
    const { error: orderStatusError } =
      await supabase
        .from('orders')
        .update({
          status: 'ready_loading',
        })
        .eq('id', orderId)

    if (orderStatusError) {
      console.error(
        'UPDATE ORDER STATUS ERROR:',
        orderStatusError
      )

      alert(orderStatusError.message)
      return
    }
  }
}

      // ==========================================
      // 4. SUCCESS
      // ==========================================

      alert(
        `Pemeriksaan berhasil disimpan.\n\n` +
        `Unit: ${truckId}\n` +
        `Hasil HSE: ${result}\n` +
        `Status Unit: ${unitStatus}`
      )

      router.refresh()

    } catch (error) {
      console.error(
        'INSPECTION ERROR:',
        error
      )

      alert(
        'Terjadi kesalahan saat menyimpan pemeriksaan.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 space-y-4"
    >

      {/* HASIL */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          Hasil Pemeriksaan
        </label>

        <select
          value={result}
          onChange={(event) =>
            setResult(event.target.value)
          }
          disabled={saving}
          required
          className="w-full rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">
            Pilih hasil pemeriksaan
          </option>

          <option value="passed">
            Passed
          </option>

          <option value="failed">
            Failed
          </option>

          <option value="on_going">
            On Going
          </option>
        </select>
      </div>

      {/* CATATAN */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          Catatan Pemeriksaan
        </label>

        <textarea
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
          rows={3}
          disabled={saving}
          placeholder="Catatan hasil pemeriksaan..."
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {/* BUTTON */}
      <button
        type="submit"
        disabled={saving || !result}
        className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? 'Menyimpan...'
          : 'Simpan Pemeriksaan'}
      </button>

    </form>
  )
}