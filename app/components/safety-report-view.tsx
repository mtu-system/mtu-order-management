import Link from 'next/link'
import { ALERT_LABEL, formatMinutes, type AlertKind } from '@/lib/alert-rules'
import type { SafetyReport } from '@/lib/safety-report'

function Trend({ now, before }: { now: number; before: number }) {
  if (now === before) return <span className="text-gray-500">sama dengan periode lalu</span>

  const better = now < before
  const diff = Math.abs(now - before)

  return (
    <span className={better ? 'text-green-700' : 'text-red-700'}>
      {better ? '▼' : '▲'} {diff} {better ? 'lebih sedikit' : 'lebih banyak'} dari
      periode lalu ({before})
    </span>
  )
}

export default function SafetyReportView({ report }: { report: SafetyReport }) {
  const maxDaily = Math.max(1, ...report.daily.map((d) => d.red + d.amber))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((days) => (
          <Link
            key={days}
            href={`?days=${days}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
              report.days === days
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {days} hari terakhir
          </Link>
        ))}
        <p className="text-xs text-gray-500">
          Dibandingkan dengan {report.days} hari sebelumnya. Cetak laporan dengan
          Ctrl+P.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500">Total peringatan</p>
          <p className="mt-1 text-3xl font-black text-gray-900">{report.totalNow}</p>
          <p className="mt-1 text-xs">
            <Trend now={report.totalNow} before={report.totalBefore} />
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500">Peringatan merah</p>
          <p className="mt-1 text-3xl font-black text-red-700">{report.redNow}</p>
          <p className="mt-1 text-xs">
            <Trend now={report.redNow} before={report.redBefore} />
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500">Unit terlibat</p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {report.unitsAffected}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Nilai risiko {report.scoreNow} (periode lalu {report.scoreBefore})
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-semibold text-gray-500">
            Penanganan peringatan merah
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {report.redHandled}/{report.redNow}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {report.avgHandleMinutes === null
              ? 'Belum ada yang ditandai ditangani'
              : `Rata-rata ditangani dalam ${formatMinutes(report.avgHandleMinutes)}`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-black text-gray-900">Peringatan per hari</h2>
        <div className="mt-4 flex h-32 items-end gap-1">
          {report.daily.map((day) => {
            const total = day.red + day.amber
            return (
              <div
                key={day.day}
                className="flex flex-1 flex-col justify-end"
                title={`${day.day}: ${day.red} merah, ${day.amber} oranye`}
              >
                <div
                  className="w-full bg-amber-400"
                  style={{ height: `${(day.amber / maxDaily) * 100}%` }}
                />
                <div
                  className="w-full bg-red-600"
                  style={{ height: `${(day.red / maxDaily) * 100}%` }}
                />
                {report.days <= 14 && (
                  <span className="mt-1 text-center text-[9px] text-gray-500">
                    {day.day.slice(8)}
                    {total > 0 ? ` (${total})` : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Merah = peringatan merah, oranye = peringatan oranye. Tanggal memakai WIB.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 xl:col-span-2">
          <h2 className="text-sm font-black text-gray-900">
            Peringkat unit paling berisiko
          </h2>
          <p className="text-[11px] text-gray-500">
            Nilai risiko: merah = 3 poin, oranye = 1 poin.
          </p>

          {report.ranking.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Tidak ada pelanggaran pada periode ini.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Unit</th>
                    <th className="py-2 pr-2">Merah</th>
                    <th className="py-2 pr-2">Oranye</th>
                    <th className="py-2 pr-2">Nilai</th>
                    <th className="py-2 pr-2">Tren</th>
                    <th className="py-2">Jenis pelanggaran</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ranking.slice(0, 20).map((unit, index) => (
                    <tr key={unit.plate} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-bold text-gray-500">
                        {index + 1}
                      </td>
                      <td className="py-2 pr-2 font-black text-gray-900">
                        {unit.plate}
                      </td>
                      <td className="py-2 pr-2 font-bold text-red-700">{unit.red}</td>
                      <td className="py-2 pr-2 font-bold text-amber-700">
                        {unit.amber}
                      </td>
                      <td className="py-2 pr-2 font-black">{unit.score}</td>
                      <td className="py-2 pr-2">
                        {unit.score > unit.prevScore ? (
                          <span className="text-red-700">▲ naik</span>
                        ) : unit.score < unit.prevScore ? (
                          <span className="text-green-700">▼ turun</span>
                        ) : (
                          <span className="text-gray-500">tetap</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-600">
                        {(Object.entries(unit.kinds) as [AlertKind, number][])
                          .map(([kind, count]) => `${ALERT_LABEL[kind]} ×${count}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-black text-gray-900">Jenis pelanggaran</h2>
          <div className="mt-3 space-y-2">
            {report.kinds.map((item) => (
              <div
                key={item.kind}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-gray-700">{item.label}</span>
                <span className="whitespace-nowrap font-bold text-gray-900">
                  {item.now}
                  <span className="ml-1 font-normal text-gray-400">
                    (lalu {item.before})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}