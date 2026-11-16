import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, BellRing, Clock, MapPinOff, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { loadAttention } from '@/lib/attention'
import { ALERT_LABEL, LOADING_WAIT_MAX_MIN, formatMinutes, type AlertKind } from '@/lib/alert-rules'
import { TRIP_LABEL, type TripStatus } from '@/lib/trip-status'
import StatCard from '@/app/components/stat-card'
import AutoRefresh from '@/app/components/auto-refresh'

function wibTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Section({
  id,
  title,
  hint,
  count,
  action,
  children,
}: {
  id: string
  title: string
  hint: string
  count: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            {title} ({count})
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">{hint}</p>
        </div>
        {action}
      </div>
      {count === 0 ? (
        <p className="px-4 py-4 text-[13px] text-slate-400">Tidak ada. Aman.</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  )
}

function Head({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((head, index) => (
          <th key={`${head}-${index}`} className="px-4 py-2 text-left">
            {head}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export default async function AttentionBoard({ base }: { base: '/operational' | '/manager' }) {
  const supabase = await createClient()
  const data = await loadAttention(supabase)

  const unackedAlerts = data.alerts.filter((alert) => !alert.acknowledged)
  const total = data.loadingWait.length + unackedAlerts.length + data.noDestination.length

  return (
    <div className="space-y-5">
      <AutoRefresh ms={60_000} />

      {!data.journeyReady && (
        <div className="panel border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Tabel status perjalanan belum tersedia, jadi &quot;lama di area muat&quot; belum bisa
          dihitung. Jalankan migration <code>20261117_fleet_journey.sql</code> di Supabase.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Perlu ditindak"
          value={total}
          hint={total === 0 ? 'Semua trip berjalan normal' : 'Lihat rincian di bawah'}
          icon={AlertTriangle}
          tone={total ? 'red' : 'green'}
          alert={total > 0}
        />
        <StatCard
          label={`Di area muat > ${formatMinutes(LOADING_WAIT_MAX_MIN)}`}
          value={data.loadingWait.length}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Peringatan belum dibaca"
          value={unackedAlerts.length}
          hint={`${data.alerts.length} peringatan aktif`}
          icon={BellRing}
          tone="red"
        />
        <StatCard
          label="Status otomatis (24 jam)"
          value={data.autoChanges.length}
          icon={Zap}
          tone="navy"
        />
      </div>

      <Section
        id="lama-muat"
        title="Lama di area muat, belum muat"
        hint={`Unit sudah di geofence area muat lebih dari ${formatMinutes(LOADING_WAIT_MAX_MIN)} tapi status trip belum Finished Loading.`}
        count={data.loadingWait.length}
      >
        <table className="w-full min-w-[760px] text-[13px]">
          <Head columns={['Plat', 'Customer · PK', 'Area', 'Sudah di area', '']} />
          <tbody>
            {data.loadingWait.map((item) => (
              <tr key={item.truckId}>
                <td className="px-4 py-2 font-semibold text-slate-900">
                  {item.plate}
                  <span className="ml-1.5 font-normal text-slate-500">{item.vehicleType || ''}</span>
                </td>
                <td className="px-4 py-2">
                  {item.customer} · PK {item.pkNumber || '-'}
                </td>
                <td className="px-4 py-2">{item.fenceName}</td>
                <td className="px-4 py-2 font-semibold text-amber-700">
                  {formatMinutes(item.minutes)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`${base}/orders/${item.orderId}`} className="btn btn-secondary">
                    Buka order
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        id="peringatan"
        title="Peringatan aktif"
        hint="Dari pemantauan GPS: berhenti di luar area, GPS mati saat trip, jam mengemudi, overspeed, jalan malam. Yang belum dibaca di atas."
        count={data.alerts.length}
        action={
          <Link href={`${base}/alerts`} className="btn btn-secondary">
            Buka Peringatan
          </Link>
        }
      >
        <table className="w-full min-w-[760px] text-[13px]">
          <Head columns={['Plat', 'Peringatan', 'Customer', 'Sejak', 'Status']} />
          <tbody>
            {data.alerts.map((alert) => (
              <tr key={alert.id}>
                <td className="px-4 py-2 font-semibold text-slate-900">{alert.plate || '-'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                      alert.level === 'red' ? 'bg-red-600' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-medium">
                    {ALERT_LABEL[alert.kind as AlertKind] || alert.kind}
                  </span>
                  <span className="ml-1.5 text-slate-500">{alert.message}</span>
                </td>
                <td className="px-4 py-2">{alert.customer || '-'}</td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                  {wibTime(alert.startedAt)}
                </td>
                <td className="px-4 py-2">
                  {alert.acknowledged ? (
                    <span className="text-slate-400">Sudah dibaca</span>
                  ) : (
                    <span className="font-semibold text-red-700">Belum dibaca</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        id="tanpa-tujuan"
        title="Trip berjalan tanpa tujuan bongkar"
        hint="Status Finished Unloading otomatis paling akurat kalau tujuan bongkar diset. Pilih Tujuan di Control Tower (klik unit, lalu pilih Tujuan)."
        count={data.noDestination.length}
        action={
          <Link href={`${base}/control-tower`} className="btn btn-secondary">
            <MapPinOff className="h-3.5 w-3.5" />
            Buka Control Tower
          </Link>
        }
      >
        <table className="w-full min-w-[640px] text-[13px]">
          <Head columns={['Plat', 'Customer · PK', 'Status Trip']} />
          <tbody>
            {data.noDestination.map((item) => (
              <tr key={item.truckId}>
                <td className="px-4 py-2 font-semibold text-slate-900">{item.plate}</td>
                <td className="px-4 py-2">
                  <Link href={`${base}/orders/${item.orderId}`} className="hover:underline">
                    {item.customer} · PK {item.pkNumber || '-'}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {TRIP_LABEL[item.tripStatus as TripStatus] || item.tripStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        id="otomatis"
        title="Perubahan status otomatis (24 jam)"
        hint="Dibuat sistem dari GPS & geofence. Kalau ada yang salah, koreksi di Monitoring seperti biasa."
        count={data.autoChanges.length}
      >
        <table className="w-full min-w-[760px] text-[13px]">
          <Head columns={['Waktu', 'Perubahan', 'Customer', 'Keterangan']} />
          <tbody>
            {data.autoChanges.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                  {wibTime(item.changedAt)}
                </td>
                <td className="px-4 py-2 font-medium">
                  {item.from || '-'} → {item.to || '-'}
                </td>
                <td className="px-4 py-2">
                  <Link href={`${base}/orders/${item.orderId}#riwayat`} className="hover:underline">
                    {item.customer}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{item.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}
