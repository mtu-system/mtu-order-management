'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { useConfirm } from '@/app/components/confirm-dialog-provider'
import { logOrderHistory } from '@/lib/history'
import VehicleTypeAutocomplete from '@/app/marketing/components/vehicle-type-autocomplete'
import { Send, Loader2, CheckCircle2, PlusCircle, Trash2 } from 'lucide-react'

type Requirement = {
  id: number | string
  vehicle_type: string
  quantity: number
}

type BookingResponseFormProps = {
  orderId: string
  status: 'booking_confirmed' | 'booking_rejected'
  requirements: Requirement[]
  decisionNote?: string | null
  pkNumber?: string | null
  rftTrJob?: string | null
  trip?: string | null
  instruction?: string | null
  notes?: string | null
  bawaRa?: string | null
}

export default function BookingResponseForm({
  orderId,
  decisionNote,
  status,
  requirements,
  pkNumber,
  rftTrJob,
  trip,
  instruction,
  notes,
  bawaRa,
}: BookingResponseFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [approving, setApproving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [revising, setRevising] = useState(false)

  const [mode, setMode] = useState<'idle' | 'revise' | 'activate' | 'cancel'>(
    'idle'
  )
  const [reason, setReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [rows, setRows] = useState<Requirement[]>(
    requirements.map((item) => ({ ...item }))
  )

  const [activatePk, setActivatePk] = useState(pkNumber || '')
  const [activateRft, setActivateRft] = useState(rftTrJob || '')
  const [activateTrip, setActivateTrip] = useState(trip || '')
  const [activateInstruction, setActivateInstruction] = useState(
    instruction || ''
  )
  const [activateNotes, setActivateNotes] = useState(notes || '')
  const [activateBawaRa, setActivateBawaRa] = useState(bawaRa || 'Tidak')

  function updateVehicleType(id: number | string, vehicle_type: string) {
    setRows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, vehicle_type } : item
      )
    )
  }

  function updateQuantity(id: number | string, quantity: number) {
    setRows((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, quantity: quantity < 1 ? 1 : quantity }
          : item
      )
    )
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: `new-${Date.now()}`, vehicle_type: '', quantity: 1 },
    ])
  }

  function removeRow(id: number | string) {
    setRows((current) => current.filter((item) => item.id !== id))
  }

  async function handleActivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (approving) return

    const trimmedPk = activatePk.trim()
    const trimmedRft = activateRft.trim()
    const trimmedTrip = activateTrip.trim()

    if (!trimmedPk && !trimmedRft) {
      toast.error(
        'Data Belum Lengkap',
        'Isi minimal salah satu: Nomor PK atau RFT/TR/Job.'
      )
      return
    }

    if (!trimmedTrip) {
      toast.error('Data Belum Lengkap', 'Trip wajib diisi.')
      return
    }

    if (trimmedPk && trimmedPk !== (pkNumber || '').trim()) {
      const { data: existingOrderWithPk, error: pkCheckError } =
        await supabase
          .from('orders')
          .select('id')
          .eq('pk_number', trimmedPk)
          .neq('id', orderId)
          .maybeSingle()

      if (pkCheckError) {
        console.error('CHECK PK DUPLICATE ERROR:', pkCheckError)
      }

      if (existingOrderWithPk) {
        toast.error(
          'PK Sudah Digunakan',
          `PK "${trimmedPk}" sudah dipakai di order lain. Gunakan PK yang berbeda.`
        )
        return
      }
    }

    const confirmed = await confirm({
      title: 'Jalankan Order Ini?',
      message:
        'Booking ini akan masuk ke flow order biasa (Operational akan alokasi unit & isi detail truk mendekati hari-H). Lanjutkan?',
      confirmLabel: 'Ya, Jalankan',
    })

    if (!confirmed) return

    setApproving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const orderType = trimmedPk ? 'PK' : trimmedRft ? 'RFT' : null

      const { error, data } = await supabase
        .from('orders')
        .update({
          pk_number: trimmedPk || null,
          rft_tr_job: trimmedRft || null,
          order_type: orderType,
          trip: trimmedTrip,
          instruction: activateInstruction.trim() || null,
          bawa_ra: activateBawaRa,
          notes: activateNotes.trim() || null,
          status: 'waiting_unit',
        })
        .eq('id', orderId)
        .eq('status', 'booking_confirmed')
        .select('id')

      if (error) {
        console.error('APPROVE BOOKING ERROR:', error)

        if (error.code === '23505') {
          toast.error(
            'Nomor PK Sudah Dipakai',
            'Nomor PK ini sudah digunakan order lain. Cek kembali nomor PK-nya.'
          )
        } else {
          toast.error('Gagal Approve Booking', error.message)
        }
        return
      }

      if (!data || data.length === 0) {
        toast.error(
          'Sudah Berubah',
          'Booking ini sudah berubah statusnya. Silakan refresh halaman.'
        )
        router.refresh()
        return
      }

      await logOrderHistory({
        orderId,
        action: 'booking_approved',
        fieldName: 'status',
        oldValue: 'booking_confirmed',
        newValue: 'waiting_unit',
        reason: 'Marketing approve booking, order mulai diproses seperti order biasa.',
        changedBy: user?.id || null,
      })

      if (trimmedPk !== (pkNumber || '').trim()) {
        await logOrderHistory({
          orderId,
          action: 'change_pk',
          fieldName: 'pk_number',
          oldValue: pkNumber || '-',
          newValue: trimmedPk || '-',
          reason: 'Diisi saat approve & jalankan booking.',
          changedBy: user?.id || null,
        })
      }

      if (trimmedRft !== (rftTrJob || '').trim()) {
        await logOrderHistory({
          orderId,
          action: 'change_rft',
          fieldName: 'rft_tr_job',
          oldValue: rftTrJob || '-',
          newValue: trimmedRft || '-',
          reason: 'Diisi saat approve & jalankan booking.',
          changedBy: user?.id || null,
        })
      }

      if (trimmedTrip !== (trip || '').trim()) {
        await logOrderHistory({
          orderId,
          action: 'change_trip',
          fieldName: 'trip',
          oldValue: trip || '-',
          newValue: trimmedTrip || '-',
          reason: 'Diisi/diubah saat approve & jalankan booking.',
          changedBy: user?.id || null,
        })
      }

      toast.success(
        'Booking Dijalankan',
        'Order sekarang masuk flow biasa di Operational.'
      )
      setMode('idle')
      router.refresh()
    } catch (error) {
      console.error('APPROVE BOOKING ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal approve booking.')
    } finally {
      setApproving(false)
    }
  }

  async function handleCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (cancelling) return

    const trimmedReason = cancelReason.trim()

    if (!trimmedReason) {
      toast.error('Data Belum Lengkap', 'Alasan pembatalan wajib diisi.')
      return
    }

    const confirmed = await confirm({
      title: 'Batalkan Booking?',
      message:
        status === 'booking_confirmed'
          ? 'Operational menyatakan booking ini mumpuni, tapi booking akan ditutup dan dicatat sebagai dibatalkan. Lanjutkan?'
          : 'Booking ini akan ditutup dan dicatat sebagai dibatalkan.',
      confirmLabel: 'Ya, Batalkan',
      danger: true,
    })

    if (!confirmed) return

    setCancelling(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancel_reason: trimmedReason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id || null,
        })
        .eq('id', orderId)

      if (error) {
        console.error('CANCEL BOOKING ERROR:', error)
        toast.error('Gagal Membatalkan Booking', error.message)
        return
      }

      await logOrderHistory({
        orderId,
        action: 'booking_cancelled',
        fieldName: 'status',
        oldValue: status,
        newValue: 'cancelled',
        reason: trimmedReason,
        changedBy: user?.id || null,
      })

      toast.success('Booking Dibatalkan', 'Booking ini sudah ditutup.')
      setMode('idle')
      setCancelReason('')
      router.refresh()
    } catch (error) {
      console.error('CANCEL BOOKING ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal membatalkan booking.')
    } finally {
      setCancelling(false)
    }
  }

  async function handleRevise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (revising) return

    if (!reason.trim()) {
      toast.error('Data Belum Lengkap', 'Alasan revisi wajib diisi.')
      return
    }

    const hasInvalidRow = rows.some(
      (row) => !row.vehicle_type.trim() || row.quantity < 1
    )

    if (hasInvalidRow || rows.length === 0) {
      toast.error(
        'Data Belum Lengkap',
        'Jenis kendaraan dan jumlah wajib diisi dengan benar.'
      )
      return
    }

    setRevising(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Update baris yang sudah ada (by id), insert baris baru (id lokal
      // "new-..."). Hindari DELETE+INSERT ulang semua baris -- RLS
      // order_requirements di project ini cuma teruji buat UPDATE/INSERT,
      // belum ada precedent DELETE.
      const existingRows = rows.filter(
        (row) => typeof row.id === 'number' || !String(row.id).startsWith('new-')
      )
      const newRows = rows.filter(
        (row) => typeof row.id === 'string' && row.id.startsWith('new-')
      )

      for (const row of existingRows) {
        const { error: updateError } = await supabase
          .from('order_requirements')
          .update({
            vehicle_type: row.vehicle_type.trim(),
            quantity: row.quantity,
          })
          .eq('id', row.id)

        if (updateError) {
          console.error('UPDATE REQUIREMENT ERROR:', updateError)
          toast.error('Gagal Merevisi', updateError.message)
          return
        }
      }

      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from('order_requirements')
          .insert(
            newRows.map((row) => ({
              order_id: orderId,
              vehicle_type: row.vehicle_type.trim(),
              quantity: row.quantity,
            }))
          )

        if (insertError) {
          console.error('INSERT NEW REQUIREMENTS ERROR:', insertError)
          toast.error('Gagal Merevisi', insertError.message)
          return
        }
      }

      // Baris asli yang dihapus dari daftar (jarang terjadi) -- coba
      // DELETE, tapi kalau ditolak RLS jangan gagalkan seluruh revisi.
      const removedIds = requirements
        .map((item) => item.id)
        .filter((id) => !rows.some((row) => row.id === id))

      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_requirements')
          .delete()
          .in('id', removedIds)

        if (deleteError) {
          console.error(
            'DELETE REMOVED REQUIREMENT ERROR (non-fatal):',
            deleteError
          )
          toast.warning(
            'Sebagian Tidak Terhapus',
            'Baris kendaraan yang dihapus gagal dibuang (izin belum ada), tapi revisi lain tetap tersimpan.'
          )
        }
      }

      const totalQuantity = rows.reduce(
        (total, row) => total + Number(row.quantity || 0),
        0
      )

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          quantity: totalQuantity,
          status: 'booking_review',
          booking_decision: null,
          booking_decision_note: null,
          booking_decided_by: null,
          booking_decided_at: null,
        })
        .eq('id', orderId)

      if (orderError) {
        console.error('RESET BOOKING STATUS ERROR:', orderError)
        toast.error('Gagal Merevisi', orderError.message)
        return
      }

      await logOrderHistory({
        orderId,
        action: 'booking_revised',
        fieldName: 'status',
        oldValue: 'booking_rejected',
        newValue: 'booking_review',
        reason: reason.trim(),
        changedBy: user?.id || null,
      })

      toast.success(
        'Revisi Terkirim',
        'Booking diajukan ulang, menunggu cek kapasitas Operational.'
      )

      setMode('idle')
      setReason('')
      router.refresh()
    } catch (error) {
      console.error('REVISE BOOKING ERROR:', error)
      toast.error('Terjadi Kesalahan', 'Gagal merevisi booking.')
    } finally {
      setRevising(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'

  function renderCancelForm() {
    return (
      <form onSubmit={handleCancel} className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Alasan Pembatalan
          </label>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            disabled={cancelling}
            rows={3}
            placeholder="Contoh: Customer batal, tidak jadi kirim unit."
            className={`resize-none bg-white ${inputClass}`}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={cancelling}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {cancelling ? 'Membatalkan...' : 'Ya, Batalkan Booking'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('idle')
              setCancelReason('')
            }}
            disabled={cancelling}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
        </div>
      </form>
    )
  }

  if (status === 'booking_confirmed') {
    return (
      <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />
          Operational Menyatakan Mumpuni
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          Booking ini bisa dicover MTU. Approve untuk mulai diproses seperti
          order biasa, atau batalkan kalau ternyata tidak jadi jalan.
        </p>

        {decisionNote && (
          <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-medium text-emerald-900">
            Catatan Operational: {decisionNote}
          </p>
        )}

        {mode === 'idle' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMode('activate')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve & Jalankan Booking
            </button>

            <button
              type="button"
              onClick={() => setMode('cancel')}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Batalkan Booking
            </button>
          </div>
        )}

        {mode === 'cancel' && renderCancelForm()}

        {mode === 'activate' && (
          <form onSubmit={handleActivate} className="mt-4 space-y-4">
            <div className="rounded-lg bg-white/70 p-3 text-xs text-emerald-900">
              <strong>Kebutuhan:</strong>{' '}
              {requirements.length
                ? requirements
                    .map((item) => `${item.vehicle_type} x${item.quantity}`)
                    .join(', ')
                : '-'}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Nomor PK
                </label>
                <input
                  type="text"
                  value={activatePk}
                  onChange={(event) => setActivatePk(event.target.value)}
                  placeholder="Contoh: PK/HI/26/1096"
                  disabled={approving}
                  className={`bg-white ${inputClass}`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  RFT / TR / Job
                </label>
                <input
                  type="text"
                  value={activateRft}
                  onChange={(event) => setActivateRft(event.target.value)}
                  placeholder="Contoh: RFT-001"
                  disabled={approving}
                  className={`bg-white ${inputClass}`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Trip
                </label>
                <input
                  type="text"
                  value={activateTrip}
                  onChange={(event) => setActivateTrip(event.target.value)}
                  placeholder="Contoh: BSD - ONWJ"
                  disabled={approving}
                  className={`bg-white ${inputClass}`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Instruksi
                </label>
                <textarea
                  value={activateInstruction}
                  onChange={(event) =>
                    setActivateInstruction(event.target.value)
                  }
                  rows={2}
                  disabled={approving}
                  className={`resize-none bg-white ${inputClass}`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Bawa RA
                </label>
                <select
                  value={activateBawaRa}
                  onChange={(event) => setActivateBawaRa(event.target.value)}
                  disabled={approving}
                  className={`bg-white ${inputClass}`}
                >
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Catatan Tambahan
                </label>
                <textarea
                  value={activateNotes}
                  onChange={(event) => setActivateNotes(event.target.value)}
                  rows={2}
                  disabled={approving}
                  className={`resize-none bg-white ${inputClass}`}
                />
              </div>
            </div>

            <p className="text-xs text-emerald-800">
              Isi minimal salah satu: Nomor PK atau RFT/TR/Job.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={approving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {approving ? 'Memproses...' : 'Jalankan Order Sekarang'}
              </button>

              <button
                type="button"
                onClick={() => setMode('idle')}
                disabled={approving}
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-red-900">
        Operational Menyatakan Tidak Mumpuni
      </h2>
      <p className="mt-1 text-sm text-red-800">
        Pilih tindak lanjut: revisi kebutuhan lalu ajukan ulang ke
        Operational, atau batalkan booking ini.
      </p>

      {decisionNote && (
        <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-medium text-red-900">
          Alasan Operational: {decisionNote}
        </p>
      )}

      {mode === 'idle' && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('revise')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2563EB]/85"
          >
            <Send className="h-4 w-4" />
            Revisi & Ajukan Ulang
          </button>

          <button
            type="button"
            onClick={() => setMode('cancel')}
            disabled={cancelling}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Batalkan Booking
          </button>
        </div>
      )}

      {mode === 'cancel' && renderCancelForm()}

      {mode === 'revise' && (
        <form onSubmit={handleRevise} className="mt-4 space-y-4">
          <div className="space-y-2.5">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-end gap-2.5 rounded-xl border border-gray-200 bg-white p-3.5"
              >
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                    Jenis Kendaraan
                  </label>
                  <VehicleTypeAutocomplete
                    value={row.vehicle_type}
                    onChange={(value) => updateVehicleType(row.id, value)}
                    disabled={revising}
                  />
                </div>

                <div className="w-20">
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) =>
                      updateQuantity(row.id, Number(event.target.value))
                    }
                    disabled={revising}
                    className={`bg-white ${inputClass}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1 || revising}
                  className="rounded-lg border border-gray-200 p-2.5 text-gray-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            disabled={revising}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Tambah Jenis Kendaraan
          </button>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Alasan Revisi
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={revising}
              rows={3}
              placeholder="Contoh: Customer setuju kurangi jadi 10 Trailer supaya MTU bisa cover."
              className={`resize-none ${inputClass}`}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={revising}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2563EB]/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {revising ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {revising ? 'Mengirim...' : 'Ajukan Ulang ke Operational'}
            </button>

            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={revising}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}