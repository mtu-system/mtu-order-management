import type { LucideIcon } from 'lucide-react'

export type StatTone =
  | 'navy'
  | 'blue'
  | 'amber'
  | 'green'
  | 'violet'
  | 'red'
  | 'slate'

const TONES: Record<StatTone, { box: string; value: string }> = {
  navy: { box: 'bg-[#082868]/10 text-[#082868]', value: 'text-[#082868]' },
  blue: { box: 'bg-blue-100 text-blue-700', value: 'text-blue-700' },
  amber: { box: 'bg-amber-100 text-amber-700', value: 'text-amber-700' },
  green: { box: 'bg-emerald-100 text-emerald-700', value: 'text-emerald-700' },
  violet: { box: 'bg-violet-100 text-violet-700', value: 'text-violet-700' },
  red: { box: 'bg-red-100 text-red-700', value: 'text-red-700' },
  slate: { box: 'bg-slate-100 text-slate-600', value: 'text-slate-700' },
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
  const className = `stat-card flex w-full flex-col items-start p-5 text-left ${
    active ? 'ring-2 ring-[#082868]' : ''
  } ${alert ? 'stat-card-alert' : ''} ${onClick ? 'cursor-pointer' : ''}`

  const body = (
    <>
      <span
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${t.box}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[13px] font-semibold text-slate-600">{label}</span>
      <span
        className={`mt-1 text-[32px] font-extrabold leading-none ${t.value}`}
      >
        {value}
      </span>
      {hint && <span className="mt-2 text-[12px] text-slate-500">{hint}</span>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}