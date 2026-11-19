'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Download, Pencil, RefreshCw, Search } from 'lucide-react'
import { useToast } from '@/app/components/toast-provider'
import type { MonitoringReport, ReportGroup, ReportUnit } from '@/lib/monitoring-report'
import { downloadMonitoringExcel, formatStandby, remarkOf, wibStamp } from '@/lib/monitoring-excel'
import { saveMonitoringUnit, type MonitoringTimeField } from './monitoring-report-actions'

const TIME_COLUMNS: { field: MonitoringTimeField; key: keyof ReportUnit; label: string }[] = [
  { field: 'pool_departed_at', key: 'poolDepartedAt', label: 'ATD Pool' },
  { field: 'origin_arrived_at', key: 'originArrivedAt', label: 'Tiba Muat' },
  { field: 'finished_loading_at', key: 'loadedAt', label: 'Selesai Muat' },
  { field: 'destination_arrived_at', key: 'destinationArrivedAt', label: 'Tiba Bongkar' },
  { field: 'finished_unloading_at', key: 'unloadedAt', label: 'Selesai Bongkar' },
  { field: 'completed_at', key: 'poolArrivedAt', label: 'Tiba Pool' },
]

const inputClass =
  'h-8 w-full rounded-md border border-[var(--border-strong)] bg-white px-2 text-[12.5px] outline-none focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10'

// ISO -> nilai <input type="datetime-local"> dalam WIB, dan sebaliknya.
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  return new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16)
}
function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null
}
function shortWib(iso: string | null) {
  if (!iso) return '-'
  const s = wibStamp(new Date(iso))
  return `${s.date.slice(0, 5)} ${s.time}`
}

function UnitRow({ unit, index, editable }: { unit: ReportUnit; index: number; editable: boolean }) {
  const toast = useToast()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<Record<string, string>>({})

  function startEdit() {
    const next: Record<string, string> = { note: unit.note || '' }
    for (const col of TIME_COLUMNS) next[col.field] = toLocalInput(unit[col.key] as string | null)
    setDraft(next)
    setEditing(true)
  }

  function save() {
    const patch: Record<string, string | null> = { monitoring_note: draft.note || null }
    for (const col of TIME_COLUMNS) {
      const before = toLocalInput(unit[col.key] as string | null)
      if (draft[col.field] !== before) patch[col.field] = fromLocalInput(draft[col.field])
    }
    startTransition(async () => {
      const result = await saveMonitoringUnit(unit.id, patch)
      if (!result.ok) {
        toast.error('Gagal menyimpan', result.message)
        return
      }
      toast.success('Tersimpan', `${unit.plate || 'Unit'} diperbarui.`)
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-900">{unit.plate || '-'}</div>
        <div className="text-[11.5px] text-slate-500">{unit.vehicleType}</div>
        <div className="text-[11.5px] text-slate-500">
          {unit.driverName}
          {unit.driverPhone ? ` · ${unit.driverPhone}` : ''}
        </div>
        {unit.pk && <div className="text-[11px] text-slate-400">{unit.pk}</div>}
      </td>
      {TIME_COLUMNS.map((col) => (
        <td key={col.field} className="px-2 py-2 text-[12.5px] text-slate-700">
          {editing ? (
            <input
              type="datetime-local"
              className={inputClass}
              value={draft[col.field] || ''}
              onChange={(event) => setDraft((d) => ({ ...d, [col.field]: event.target.value }))}
              disabled={pending}
            />
          ) : (
            <span className={unit[col.key] ? '' : 'text-slate-300'}>{shortWib(unit[col.key] as string | null)}</span>
          )}
        </td>
      ))}
      <td className="px-2 py-2 text-[12px] text-slate-600">
        <div>Muat: {formatStandby(unit.originArrivedAt, unit.loadedAt) || '-'}</div>
        <div>Bongkar: {formatStandby(unit.destinationArrivedAt, unit.unloadedAt) || '-'}</div>
      </td>
      <td className="px-2 py-2 text-[12.5px] text-slate-700">
        {unit.position ? (
          unit.position.lat != null && unit.position.lng != null ? (
            <a
              href={`https://www.google.com/maps?q=${unit.position.lat},${unit.position.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#082868] hover:underline"
            >
              {unit.position.text}
            </a>
          ) : (
            unit.position.text
          )
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-2 py-2 text-[12.5px]">
        {editing ? (
          <input
            className={inputClass}
            placeholder="Catatan, mis. Cover CDD"
            value={draft.note || ''}
            onChange={(event) => setDraft((d) => ({ ...d, note: event.target.value }))}
            disabled={pending}
          />
        ) : (
          <span className="font-medium text-slate-800">{remarkOf(unit)}</span>
        )}
      </td>
      {editable && (
        <td className="px-2 py-2 text-right">
          {editing ? (
            <div className="flex justify-end gap-1">
              <button type="button" className="btn btn-primary h-8 px-2.5" onClick={save} disabled={pending}>
                Simpan
              </button>
              <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={() => setEditing(false)} disabled={pending}>
                Batal
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary h-8 px-2.5" onClick={startEdit} aria-label="Koreksi jam">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

function GroupPanel({ group, editable }: { group: ReportGroup; editable: boolean }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      await downloadMonitoringExcel(group)
    } catch (error) {
      toast.error('Gagal membuat Excel', error instanceof Error ? error.message : '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-slate-900">{group.rft}</div>
            <div className="truncate text-[12.5px] text-slate-500">
              {group.customer} · {group.pks.join(', ') || '-'}
            </div>
            <div className="truncate text-[12px] text-slate-400">{group.trips.join(' | ')}</div>
          </div>
        </button>
        <div className="flex items-center gap-2 text-[12px]">
          {group.activeCount > 0 && (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
              {group.activeCount} berjalan
            </span>
          )}
          {group.doneCount > 0 && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
              {group.doneCount} selesai
            </span>
          )}
          <button type="button" className="btn btn-primary h-8 px-3" onClick={download} disabled={busy}>
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2">No</th>
                <th className="px-3 py-2">Unit</th>
                {TIME_COLUMNS.map((col) => (
                  <th key={col.field} className="px-2 py-2">
                    {col.label}
                  </th>
                ))}
                <th className="px-2 py-2">Standby</th>
                <th className="px-2 py-2">Posisi</th>
                <th className="px-2 py-2">Remarks</th>
                {editable && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {group.units.map((unit, index) => (
                <UnitRow key={unit.id} unit={unit} index={index} editable={editable} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function MonitoringReportView({
  report,
  editable,
}: {
  report: MonitoringReport
  editable: boolean
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return report.groups.filter((group) => {
      if (!showDone && group.activeCount === 0) return false
      if (!q) return true
      const haystack = [
        group.rft,
        group.customer,
        ...group.pks,
        ...group.trips,
        ...group.units.map((unit) => `${unit.plate} ${unit.driverName}`),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [report.groups, query, showDone])

  const stamp = wibStamp(new Date(report.fetchedAt))

  return (
    <div className="space-y-4">
      {!report.timesReady && (
        <div className="panel border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
          Kolom jam laporan belum ada di database. Jalankan migrasi{' '}
          <code className="font-mono">20261119_monitoring_report.sql</code> supaya ATD Pool, tiba di lokasi muat dan
          tiba di lokasi bongkar terisi otomatis dan bisa dikoreksi.
        </div>
      )}
      {report.gpsError && (
        <div className="panel border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
          Posisi GPS gagal dimuat (Tracksolid sedang membatasi permintaan). Coba muat ulang sebentar lagi.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari RFT, customer, PK, plat, driver..."
            className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-white pl-8 pr-3 text-[13px] outline-none focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
          Tampilkan RFT yang sudah selesai (7 hari terakhir)
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Data per {stamp.time} WIB
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="panel px-4 py-8 text-center text-[13.5px] text-slate-500">
          Tidak ada RFT yang cocok.
        </div>
      ) : (
        groups.map((group) => <GroupPanel key={group.key} group={group} editable={editable} />)
      )}
    </div>
  )
}
