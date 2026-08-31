'use client'

import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import { actorLabel, getActivityMessage } from '@/lib/activity-labels'

type LogItem = {
  id: string
  action: string
  new_value: string | null
  reason: string | null
  changed_at: string
  customer: string
  pkNumber: string | null
}

type ActivityLogsFeedProps = {
  items: LogItem[]
}

type ActorFilter = 'all' | 'Marketing' | 'Operational' | 'HSE'

const PAGE_SIZE = 40

const actorBadgeClass: Record<string, string> = {
  Marketing: 'bg-emerald-100 text-emerald-700',
  Operational: 'bg-[#01236A]/10 text-[#01236A]',
  HSE: 'bg-amber-100 text-amber-800',
  System: 'bg-gray-100 text-gray-600',
}

function getDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function getDateHeaderLabel(dateKey: string) {
  const todayKey = getDateKey(new Date().toISOString())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = getDateKey(yesterday.toISOString())

  if (dateKey === todayKey) return 'Hari Ini'
  if (dateKey === yesterdayKey) return 'Kemarin'

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00+07:00`))
}

export default function ActivityLogsFeed({ items }: ActivityLogsFeedProps) {
  const [filter, setFilter] = useState<ActorFilter>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(
      (item) => (actorLabel[item.action] || 'System') === filter
    )
  }, [items, filter])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleItems.length < filteredItems.length

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, LogItem[]>()

    for (const item of visibleItems) {
      const key = getDateKey(item.changed_at)
      const existing = groups.get(key) || []
      existing.push(item)
      groups.set(key, existing)
    }

    return Array.from(groups.entries())
  }, [visibleItems])

  function handleFilterChange(next: ActorFilter) {
    setFilter(next)
    setVisibleCount(PAGE_SIZE)
  }

  const filters: { key: ActorFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'Marketing', label: 'Marketing' },
    { key: 'Operational', label: 'Operational' },
    { key: 'HSE', label: 'HSE' },
  ]

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-gray-100 px-5 py-3">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleFilterChange(item.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filter === item.key
                ? 'bg-[#01236A] text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </button>
        ))}

        <span className="ml-auto text-xs font-semibold text-gray-400">
          {filteredItems.length} entri
        </span>
      </div>

      {groupedByDate.length > 0 ? (
        <>
          {groupedByDate.map(([dateKey, dateItems]) => (
            <div key={dateKey}>
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/90 px-5 py-2 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  {getDateHeaderLabel(dateKey)}
                </p>
              </div>

              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {dateItems.map((item) => {
                    const time = new Date(item.changed_at).toLocaleTimeString(
                      'id-ID',
                      {
                        timeZone: 'Asia/Jakarta',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )

                    const actor = actorLabel[item.action] || 'System'
                    const message = getActivityMessage(
                      item.action,
                      item.new_value
                    )

                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-gray-50/60"
                      >
                        <td className="w-16 whitespace-nowrap px-5 py-2 align-top text-xs text-gray-400">
                          {time}
                        </td>
                        <td className="w-28 px-2 py-2 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              actorBadgeClass[actor] || actorBadgeClass.System
                            }`}
                          >
                            {actor}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <p className="font-semibold text-gray-900">
                            {message}
                          </p>
                          {item.reason && (
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {item.reason}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-right align-top text-xs text-gray-500">
                          {item.customer} · {item.pkNumber || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {hasMore && (
            <div className="border-t border-gray-100 p-3 text-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) => current + PAGE_SIZE)
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Muat Lebih Banyak (
                {filteredItems.length - visibleItems.length} lagi)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-400">
            Tidak ada aktivitas untuk filter ini.
          </p>
        </div>
      )}
    </div>
  )
}