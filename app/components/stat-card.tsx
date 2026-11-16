import type { LucideIcon } from 'lucide-react'

export type StatTone =
  | 'navy'
  | 'blue'
  | 'amber'
  | 'green'
  | 'violet'
  | 'red'
  | 'slate'

// Warna hanya di ikon & angka -- kartu tetap putih polos.
const TONES: Record<StatTone, { icon: string; value: string }> = {
  navy: { icon: 'text-[#082868]', value: 'text-slate-900' },
  blue: { icon: 'text-blue-600', value: 'text-slate-900' },
  amber: { icon: 'text-amber-600', value: 'text-slate-900' },
  green: { icon: 'text-emerald-600', value: 'text-slate-900' },
  violet: { icon: 'text-violet-600', value: 'text-slate-900' },
  red: { icon: 'text-red-600', value: 'text-red-700' },
  slate: { icon: 'text-slate-500', value: 'text-slate-900' },
}

type StatCardProps = {
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  tone?: StatTone
  active?: boolean
  alert?: boolean
  onClick?: () => void
}

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
  active = false,
  alert = false,
  onClick,
}: StatCardProps) {
  const t = TONES[tone]
  const className = `stat-card flex w-full flex-col items-start px-4 py-3.5 text-left ${
    active ? 'border-[#082868] ring-1 ring-[#082868]' : ''
  } ${alert ? 'stat-card-alert' : ''} ${onClick ? 'cursor-pointer' : ''}`

  const body = (
    <>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
        <Icon className={`h-4 w-4 shrink-0 ${t.icon}`} />
      </span>
      <span
        className={`stat-value mt-1.5 text-[24px] font-bold leading-none tabular-nums ${t.value}`}
      >
        {value}
      </span>
      {hint && <span className="mt-1.5 text-[12px] text-slate-500">{hint}</span>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={className}
      >
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}
