// Warna badge status terpusat, dipakai di semua dashboard (Manager, Marketing,
// Operational, HSE) supaya artinya konsisten di seluruh app:
//   gray  = menunggu unit
//   blue  = di tangan HSE / inspeksi
//   amber = ada change request / butuh approval
//   green = siap / lulus / ready to depart
//   red   = gagal / dibatalkan
//   purple = status lain (mis. sedang diperiksa)

export type BadgeColor = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple'

const COLOR_CLASS: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-violet-100 text-violet-700',
}

export function Badge({
  color,
  children,
}: {
  color: BadgeColor
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${COLOR_CLASS[color]}`}
    >
      {children}
    </span>
  )
}

const ORDER_STATUS_META: Record<string, { label: string; color: BadgeColor }> = {
  waiting_unit: { label: 'Waiting Unit', color: 'gray' },
  waiting_hse: { label: 'Waiting HSE', color: 'blue' },
  inspection: { label: 'Inspection', color: 'purple' },
  ready_loading: { label: 'Ready Loading', color: 'blue' },
  ready_to_depart: { label: 'Ready to Depart', color: 'green' },
  failed: { label: 'Gagal', color: 'red' },
  cancelled: { label: 'Dibatalkan', color: 'red' },
}

/** Badge status order (kolom `orders.status`). */
export function OrderStatusBadge({ status }: { status: string | null | undefined }) {
  const meta = (status && ORDER_STATUS_META[status]) || {
    label: status || '—',
    color: 'gray' as BadgeColor,
  }
  return <Badge color={meta.color}>{meta.label}</Badge>
}

/** Badge untuk change request (change_vehicle, add_unit, reduce_unit, dll). */
export function ChangeRequestBadge({ children }: { children: React.ReactNode }) {
  return <Badge color="amber">{children}</Badge>
}
