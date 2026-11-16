import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { describeActivity } from '@/lib/activity-labels'
import {
  isNotableActivity,
  loadActivityRows,
  type ActivityRow,
} from '@/lib/activity-feed'
import type { LucideIcon } from 'lucide-react'
import {
  Clock,
  ChevronRight,
  AlertTriangle,
  Ban,
  Building2,
  RefreshCw,
  FileEdit,
  MinusCircle,
  PlusCircle,
  Truck,
  XCircle,
  FilePlus2,
  Navigation,
} from 'lucide-react'

type RecentActivityFeedProps = {
  role: 'operational' | 'hse' | 'marketing'
  limit?: number
  showHeader?: boolean
}

type ActionStyle = { icon: LucideIcon; color: string }

const RED = 'text-red-600'
const NAVY = 'text-[#082868]'

const actionStyle: Record<string, ActionStyle> = {
  hse_inspection: { icon: AlertTriangle, color: RED },
  cancel_failed_unit: { icon: Ban, color: RED },
  cancel_order: { icon: Ban, color: RED },
  booking_cancelled: { icon: Ban, color: RED },
  reject_change_request: { icon: XCircle, color: RED },
  failed_unit_to_vendor: { icon: Building2, color: 'text-violet-600' },
  replace_failed_unit: { icon: RefreshCw, color: NAVY },
  reduce_unit: { icon: MinusCircle, color: 'text-amber-600' },
  add_unit: { icon: PlusCircle, color: NAVY },
  unit_allocation: { icon: Truck, color: NAVY },
  create_order: { icon: FilePlus2, color: NAVY },
  ready_to_depart: { icon: Truck, color: 'text-emerald-600' },
  trip_status_changed: { icon: Navigation, color: NAVY },
}

const defaultStyle: ActionStyle = { icon: FileEdit, color: 'text-slate-500' }

const detailBasePath: Record<string, string> = {
  operational: '/operational/orders',
  hse: '/hse/orders',
  marketing: '/marketing/orders',
}

export default async function RecentActivityFeed({
  role,
  limit = 6,
  showHeader = true,
}: RecentActivityFeedProps) {
  const supabase = await createClient()

  const rows = await loadActivityRows(supabase, {
    perSource: 30,
    filter: isNotableActivity,
  })

  if (!rows.length) {
    if (!showHeader) {
      return (
        <div className="panel flex flex-col items-center gap-2 p-12 text-center text-slate-400">
          <Clock className="h-6 w-6" />
          <p className="text-[13px]">Belum ada aktivitas.</p>
        </div>
      )
    }
    return null
  }

  // Satu kartu per order, menampilkan kejadian terbarunya.
  const byOrder = new Map<string, { latest: ActivityRow; count: number }>()
  for (const row of rows) {
    const current = byOrder.get(row.orderId)
    if (current) current.count += 1
    else byOrder.set(row.orderId, { latest: row, count: 1 })
  }

  const groups = Array.from(byOrder.entries()).slice(0, limit)

  const content = (
    <div className="divide-y divide-[var(--border)]">
      {groups.map(([orderId, { latest, count }]) => {
        const style = actionStyle[latest.action] || defaultStyle
        const Icon = style.icon
        const text = describeActivity(latest)

        return (
          <Link
            key={orderId}
            href={`${detailBasePath[role]}/${orderId}#riwayat`}
            className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.color}`} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-slate-900">
                  {text.title}
                </p>
                {count > 1 && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    +{count - 1} lainnya
                  </span>
                )}
              </div>

              <p className="mt-0.5 truncate text-[12px] text-slate-500">
                {latest.customer} · PK {latest.pkNumber || '-'}
                {text.detail ? ` — ${text.detail}` : ''}
              </p>
            </div>

            <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-slate-400">
              {new Date(latest.changed_at).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        )
      })}
    </div>
  )

  if (!showHeader) {
    return <div className="panel overflow-hidden">{content}</div>
  }

  return (
    <div className="panel mb-6 overflow-hidden">
      <div className="panel-header">
        <div>
          <h2 className="panel-title flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Aktivitas Terbaru
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            Kejadian penting dari semua order — unit Failed, dibatalkan,
            dialihkan ke Vendor, dan perubahan request.
          </p>
        </div>
      </div>

      {content}
    </div>
  )
}
