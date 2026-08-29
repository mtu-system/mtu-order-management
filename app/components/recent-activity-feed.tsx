import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
} from 'lucide-react'

type RecentActivityFeedProps = {
  role: 'operational' | 'hse' | 'marketing'
  limit?: number
  showHeader?: boolean
}

const actionLabels: Record<string, string> = {
  reduce_unit: 'Kurangi Unit',
  add_unit: 'Tambah Unit',
  change_vehicle: 'Ganti Jenis Unit',
  change_trip: 'Ubah Trip',
  change_pk: 'Ubah PK',
  change_rft: 'Ubah RFT/TR/Job',
  change_customer: 'Ubah Customer',
  change_instruction: 'Ubah Instruksi',
  change_note: 'Ubah Catatan',
  cancel_order: 'Batalkan Order',
  replace_failed_unit: 'Ganti Detail Truk (Unit Failed)',
  failed_unit_to_vendor: 'Unit Failed Dialihkan ke Vendor',
  cancel_failed_unit: 'Unit Failed Dibatalkan',
  hse_inspection: 'Unit Gagal HSE',
}

type ActionStyle = {
  icon: any
  iconBg: string
  iconColor: string
}

const actionStyle: Record<string, ActionStyle> = {
  hse_inspection: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  cancel_failed_unit: {
    icon: Ban,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  cancel_order: {
    icon: Ban,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  failed_unit_to_vendor: {
    icon: Building2,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  replace_failed_unit: {
    icon: RefreshCw,
    iconBg: 'bg-[#01236A]/10',
    iconColor: 'text-[#01236A]',
  },
  reduce_unit: {
    icon: MinusCircle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  add_unit: {
    icon: PlusCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
  },
}

const defaultStyle = {
  icon: FileEdit,
  iconBg: 'bg-gray-100',
  iconColor: 'text-gray-500',
}

const detailBasePath: Record<string, string> = {
  operational: '/operational/orders',
  hse: '/hse/orders',
  marketing: '/marketing/orders',
}

function isNotableEntry(item: { action: string; new_value: string | null }) {
  if (item.action === 'hse_inspection') {
    return item.new_value === 'Failed'
  }
  return true
}

export default async function RecentActivityFeed({
  role,
  limit = 6,
  showHeader = true,
}: RecentActivityFeedProps) {
  const supabase = await createClient()

  const [{ data: orderHistory }, { data: unitHistory }] = await Promise.all([
    supabase
      .from('order_history')
      .select(`
        id,
        order_id,
        action,
        old_value,
        new_value,
        reason,
        changed_at,
        orders ( customer, pk_number )
      `)
      .order('changed_at', { ascending: false })
      .limit(30),
    supabase
      .from('unit_history')
      .select(`
        id,
        order_id,
        action,
        old_value,
        new_value,
        reason,
        changed_at,
        orders ( customer, pk_number )
      `)
      .order('changed_at', { ascending: false })
      .limit(30),
  ])

  const combined = [
    ...(orderHistory || []).map((item: any) => ({
      ...item,
      scope: 'order' as const,
    })),
    ...(unitHistory || []).map((item: any) => ({
      ...item,
      scope: 'unit' as const,
    })),
  ]
    .filter(isNotableEntry)
    .sort(
      (a, b) =>
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    )

  if (!combined.length) {
    if (!showHeader) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-14 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-sm text-gray-400">Belum ada aktivitas.</p>
        </div>
      )
    }
    return null
  }

  const groupsByOrder = new Map<string, typeof combined>()

  for (const item of combined) {
    const existing = groupsByOrder.get(item.order_id) || []
    existing.push(item)
    groupsByOrder.set(item.order_id, existing)
  }

  const groups = Array.from(groupsByOrder.entries())
    .map(([orderId, items]) => ({
      orderId,
      latest: items[0],
      count: items.length,
    }))
    .sort(
      (a, b) =>
        new Date(b.latest.changed_at).getTime() -
        new Date(a.latest.changed_at).getTime()
    )
    .slice(0, limit)

  const content = (
    <div className="space-y-3">
      {groups.map(({ orderId, latest, count }) => {
        const order = latest.orders
        const style = actionStyle[latest.action] || defaultStyle
        const Icon = style.icon

        return (
          <Link
            key={orderId}
            href={`${detailBasePath[role]}/${orderId}#riwayat`}
            className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 transition hover:border-[#01236A]/20 hover:shadow-sm"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}
            >
              <Icon className={`h-5 w-5 ${style.iconColor}`} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-gray-900">
                  {actionLabels[latest.action] || latest.action}
                </p>

                {count > 1 && (
                  <span className="inline-flex items-center rounded-full bg-[#01236A]/10 px-2 py-0.5 text-[11px] font-bold text-[#01236A]">
                    +{count - 1} lainnya
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs text-gray-400">
                {order?.customer || '-'} · PK {order?.pk_number || '-'}
              </p>

              {latest.reason && (
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {latest.reason}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="whitespace-nowrap text-xs text-gray-400">
                {new Date(latest.changed_at).toLocaleString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
          </Link>
        )
      })}
    </div>
  )

  if (!showHeader) {
    return content
  }

  return (
    <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
          <Clock className="h-4.5 w-4.5 text-gray-400" />
          Aktivitas Terbaru
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Kejadian penting dari semua order — unit Failed, dibatalkan,
          dialihkan ke Vendor, dan perubahan request.
        </p>
      </div>

      {content}
    </div>
  )
}