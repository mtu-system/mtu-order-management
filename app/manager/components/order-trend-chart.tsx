'use client'

import { useState } from 'react'

type TrendPoint = {
  label: string
  count: number
}

type OrderTrendChartProps = {
  data7: TrendPoint[]
  data30: TrendPoint[]
}

export default function OrderTrendChart({
  data7,
  data30,
}: OrderTrendChartProps) {
  const [range, setRange] = useState<'7' | '30'>('7')

  const data = range === '7' ? data7 : data30
  const maxCount = Math.max(...data.map((point) => point.count), 1)

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1 rounded-full bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setRange('7')}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            range === '7'
              ? 'bg-white text-[#01236A] shadow-sm'
              : 'text-gray-500'
          }`}
        >
          7 Hari
        </button>
        <button
          type="button"
          onClick={() => setRange('30')}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            range === '30'
              ? 'bg-white text-[#01236A] shadow-sm'
              : 'text-gray-500'
          }`}
        >
          30 Hari
        </button>
      </div>

     <div className="flex h-28 gap-1">
        {data.map((point, index) => (
          <div
            key={index}
            className="group relative flex flex-1 flex-col items-center justify-end"
          >
            <span className="pointer-events-none absolute -top-6 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
              {point.count}
            </span>
            <div
              className="w-full rounded-t-sm bg-[#01236A] transition-all"
              style={{
                height: `${Math.max(4, (point.count / maxCount) * 100)}%`,
                opacity: point.count === 0 ? 0.15 : 1,
              }}
            />
            {range === '7' && (
              <span className="mt-1.5 text-[9px] font-semibold text-gray-400">
                {point.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}