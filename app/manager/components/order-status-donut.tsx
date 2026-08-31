type StatusBucket = {
  label: string
  count: number
  colorHex: string
  colorClass: string
}

type OrderStatusDonutProps = {
  buckets: StatusBucket[]
}

export default function OrderStatusDonut({ buckets }: OrderStatusDonutProps) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  let cumulative = 0

  const gradientStops = buckets
    .map((bucket) => {
      const start = total === 0 ? 0 : (cumulative / total) * 360
      cumulative += bucket.count
      const end = total === 0 ? 0 : (cumulative / total) * 360
      return `${bucket.colorHex} ${start}deg ${end}deg`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full"
        style={{
          background:
            total === 0
              ? '#f3f4f6'
              : `conic-gradient(${gradientStops})`,
        }}
      >
        <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] font-semibold text-gray-400">
            Order
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: bucket.colorHex }}
            />
            <span className="text-gray-600">{bucket.label}</span>
            <span className="ml-auto font-bold text-gray-900">
              {bucket.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}