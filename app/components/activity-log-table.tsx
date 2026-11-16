'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import { actorOf, describeActivity } from '@/lib/activity-labels'
import type { ActivityRow } from '@/lib/activity-feed'

type ActorFilter = 'all' | 'Marketing' | 'Operational' | 'HSE' | 'Sistem'

type ActivityLogTableProps = {
  rows: ActivityRow[]
  // Prefix link detail order per role, mis. '/operational/orders'. null = tanpa link.
  orderBasePath?: string | null
  showActorFilter?: boolean
  pageSize?: number
}

const ACTOR_BADGE: Record<string, string> = {
  Marketing: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Operational: 'bg-[#082868]/[0.06] text-[#082868] ring-[#082868]/20',
  HSE: 'bg-amber-50 text-amber-800 ring-amber-200',
  System: 'bg-gray-50 text-gray-600 ring-gray-200',
  Sistem: 'bg-slate-100 text-slate-700 ring-slate-300',
}

const FILTERS: { key: ActorFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'Marketing', label: 'Marketing' },
  { key: 'Operational', label: 'Operational' },
  { key: 'HSE', label: 'HSE' },
  { key: 'Sistem', label: 'Sistem (otomatis)' },
]

function wib(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(
    new Date(iso)
  )
}

function dateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function minuteKey(iso: string) {
  return `${dateKey(iso)} ${wib(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
}

function dateHeader(key: string, todayKey: string, yesterdayKey: string) {
  if (key === todayKey) return 'Hari Ini'
  if (key === yesterdayKey) return 'Kemarin'
  return wib(`${key}T12:00:00+07:00`, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type Group = {
  key: string
  rows: ActivityRow[]
}

// Entri berurutan dengan order + action + menit yang sama dilebur jadi satu
// baris (mis. 4 unit Ready to Depart sekaligus, atau entri kembar).
function groupRows(rows: ActivityRow[]): Group[] {
  const groups: Group[] = []

  for (const row of rows) {
    const key = `${row.orderId}|${row.action}|${minuteKey(row.changed_at)}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.rows.push(row)
    } else {
      groups.push({ key, rows: [row] })
    }
  }

  return groups
}

export default function ActivityLogTable({
  rows,
  orderBasePath = null,
  showActorFilter = true,
  pageSize = 40,
}: ActivityLogTableProps) {
  const [filter, setFilter] = useState<ActorFilter>('all')
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? rows
        : rows.filter((row) => actorOf(row) === filter),
    [rows, filter]
  )

  const groups = useMemo(() => groupRows(filtered), [filtered])
  const visibleGroups = groups.slice(0, visibleCount)
  const remaining = groups.length - visibleGroups.length

  const byDate = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const group of visibleGroups) {
      const key = dateKey(group.rows[0].changed_at)
      map.set(key, [...(map.get(key) || []), group])
    }
    return Array.from(map.entries())
  }, [visibleGroups])

  // Dihitung sekali saat mount (label "Hari Ini" / "Kemarin").
  const [[todayKey, yesterdayKey]] = useState(() => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 864e5)
    return [dateKey(now.toISOString()), dateKey(yesterday.toISOString())]
  })

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function orderCell(row: ActivityRow) {
    const label = (
      <>
        <span className="font-medium text-slate-800">{row.customer}</span>
        <span className="text-slate-400"> · </span>
        <span className="text-slate-500">{row.pkNumber || 'Tanpa PK'}</span>
      </>
    )
    if (!orderBasePath) return <span className="block truncate">{label}</span>
    return (
      <Link
        href={`${orderBasePath}/${row.orderId}#riwayat`}
        className="block truncate hover:underline"
        title={`${row.customer} · ${row.pkNumber || 'Tanpa PK'}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header flex-wrap">
        {showActorFilter ? (
          <div className="flex flex-wrap items-center gap-1" role="tablist">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => {
                  setFilter(item.key)
                  setVisibleCount(pageSize)
                }}
                className={`h-7 rounded-md px-2.5 text-[12.5px] font-semibold transition ${
                  filter === item.key
                    ? 'bg-[#082868] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="panel-title">Aktivitas Terbaru</p>
        )}
        <span className="text-[12.5px] font-medium text-slate-500 tabular-nums">
          {filtered.length} entri · {groups.length} kejadian
        </span>
      </div>

      {byDate.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-slate-400">
          <Inbox className="h-6 w-6" />
          <p className="text-[13px]">Tidak ada aktivitas untuk filter ini.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-[13px]">
            <colgroup>
              <col className="w-[72px]" />
              <col />
              <col className="w-[260px]" />
              <col className="w-[112px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-4 text-left">Waktu</th>
                <th className="px-3 text-left">Kejadian</th>
                <th className="px-3 text-left">Order</th>
                <th className="px-4 text-left">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {byDate.map(([key, dateGroups]) => (
                <Fragment key={key}>
                  <tr className="hover:!bg-transparent">
                    <td
                      colSpan={4}
                      className="!border-t-0 bg-slate-50 px-4 !py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500"
                    >
                      {dateHeader(key, todayKey, yesterdayKey)}
                    </td>
                  </tr>

                  {dateGroups.map((group) => {
                    const first = group.rows[0]
                    const text = describeActivity(first)
                    const actor = actorOf(first)
                    const count = group.rows.length
                    const isOpen = expanded.has(group.key)

                    return (
                      <Fragment key={group.key}>
                        <tr className="align-top">
                          <td className="px-4 tabular-nums text-slate-500">
                            {wib(first.changed_at, { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3">
                            <div className="flex min-w-0 items-start gap-2">
                              {count > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggle(group.key)}
                                  aria-expanded={isOpen}
                                  aria-label={isOpen ? 'Sembunyikan rincian' : 'Tampilkan rincian'}
                                  className="mt-px flex h-5 shrink-0 items-center gap-0.5 rounded border border-[var(--border-strong)] bg-white pl-0.5 pr-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  <ChevronRight
                                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                  />
                                  ×{count}
                                </button>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">
                                  {count > 1 ? groupTitle(group.rows) : text.title}
                                </p>
                                {text.detail && (
                                  <p className="mt-0.5 truncate text-[12px] text-slate-500" title={text.detail}>
                                    {text.detail}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3">{orderCell(first)}</td>
                          <td className="px-4">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                                ACTOR_BADGE[actor] || ACTOR_BADGE.System
                              }`}
                            >
                              {actor}
                            </span>
                          </td>
                        </tr>

                        {isOpen &&
                          group.rows.map((row) => {
                            const rowText = describeActivity(row)
                            return (
                              <tr key={row.key} className="align-top bg-slate-50/60">
                                <td className="!border-t-0 px-4" />
                                <td className="!border-t-0 px-3 !py-1.5" colSpan={3}>
                                  <p className="border-l-2 border-[var(--border-strong)] pl-3 text-[12.5px] text-slate-700">
                                    {rowText.title}
                                    {rowText.detail && (
                                      <span className="text-slate-500"> — {rowText.detail}</span>
                                    )}
                                  </p>
                                </td>
                              </tr>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 && (
        <div className="border-t border-[var(--border)] p-2.5 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + pageSize)}
            className="btn btn-secondary h-8"
          >
            Muat lebih banyak ({remaining} lagi)
          </button>
        </div>
      )}
    </div>
  )
}

// Judul baris gabungan: kalimat entri pertama, atau ringkasan per unit
// kalau tiap entri menyebut unit yang berbeda.
function groupTitle(rows: ActivityRow[]) {
  const titles = rows.map((row) => describeActivity(row).title)
  const unique = Array.from(new Set(titles))
  if (unique.length === 1) return unique[0]

  const plates = Array.from(new Set(rows.map((row) => row.plate).filter(Boolean)))
  const base = describeActivity({ ...rows[0], plate: null }).title
  if (plates.length > 1) {
    return `${base.replace(/^Unit\b/, `${plates.length} unit`)}`
  }
  return titles[0]
}
