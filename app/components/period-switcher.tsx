import Link from 'next/link'
import type { Period } from '@/lib/period'

const tabClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-bold ${
    active
      ? 'bg-blue-600 text-white'
      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`

const stepClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50'

const stepOffClass =
  'rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-300'

export default function PeriodSwitcher({
  period,
  count,
  truncated = false,
}: {
  period: Period
  count: number
  truncated?: boolean
}) {
  const unit = period.mode === 'year' ? 'tahun' : 'bulan'

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`?bulan=${period.monthKey}`} className={tabClass(period.mode === 'month')}>
          Per Bulan
        </Link>
        <Link href={`?bulan=${period.yearKey}`} className={tabClass(period.mode === 'year')}>
          Per Tahun
        </Link>
        <Link href="?bulan=semua" className={tabClass(period.mode === 'all')}>
          Semua Data
        </Link>

        <span className="mx-1 h-5 w-px bg-gray-300" />

        {period.mode !== 'all' && (
          <>
            {period.prevKey ? (
              <Link href={`?bulan=${period.prevKey}`} className={stepClass}>
                ← {unit} sebelumnya
              </Link>
            ) : (
              <span className={stepOffClass}>← {unit} sebelumnya</span>
            )}

            <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              {period.label}
            </span>

            {period.nextKey ? (
              <Link href={`?bulan=${period.nextKey}`} className={stepClass}>
                {unit} berikutnya →
              </Link>
            ) : (
              <span className={stepOffClass}>{unit} berikutnya →</span>
            )}
          </>
        )}

        {period.mode === 'all' && (
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            {period.label}
          </span>
        )}

        <span className="text-xs text-gray-500">{count} data dimuat</span>
      </div>

      {truncated && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Data terlalu banyak sehingga hanya sebagian yang dimuat. Pilih Per Bulan
          atau Per Tahun supaya laporan lengkap.
        </p>
      )}
    </div>
  )
}