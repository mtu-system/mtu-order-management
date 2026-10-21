'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/toast-provider'
import { ALERT_LABEL, type AlertKind, formatMinutes } from '@/lib/alert-rules'

type AlertRow = {
  id: string
  plate: string
  customer: string | null
  trip: string | null
  kind: AlertKind
  level: 'red' | 'amber'
  message: string
  started_at: string
  resolved_at: string | null
  acknowledged_at: string | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertsTable({
  initialAlerts,
  canAck,
}: {
  initialAlerts: AlertRow[]
  canAck: boolean
}) {
  const supabase = createClient()
  const toast = useToast()

  const [alerts, setAlerts] = useState(initialAlerts)
  const [tab, setTab] = useState<'open' | 'all'>('open')

  const visible =
    tab === 'open' ? alerts.filter((alert) => !alert.resolved_at) : alerts
  const openCount = alerts.filter((alert) => !alert.resolved_at).length

  async function acknowledge(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('unit_alerts')
      .update({ acknowledged_at: now, acknowledged_by: user?.id || null })
      .eq('id', id)
      .select('id')

    if (error || !data || data.length === 0) {
      toast.error('Gagal Menyimpan', error?.message || 'Ditolak oleh database.')
      return
    }

    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id ? { ...alert, acknowledged_at: now } : alert
      )
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex gap-1.5 border-b border-gray-200 px-5 py-3">
        {[
          ['open', `Terbuka (${openCount})`],
          ['all', 'Semua Riwayat'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as 'open' | 'all')}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              tab === key
                ? 'bg-[#2563EB] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              {['Mulai', 'Unit', 'Jenis', 'Keterangan', 'Status', 'Penanganan'].map(
                (heading) => (
                  <th key={heading} className="px-5 py-3 font-semibold">
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-gray-400">
                  Tidak ada peringatan.
                </td>
              </tr>
            ) : (
              visible.map((alert) => {
                const end = alert.resolved_at
                  ? new Date(alert.resolved_at).getTime()
                  : Date.now()
                const minutes = (end - new Date(alert.started_at).getTime()) / 60000

                return (
                  <tr key={alert.id} className="align-top">
                    <td className="px-5 py-3">{formatDateTime(alert.started_at)}</td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-gray-900">{alert.plate}</p>
                      <p className="text-[11px] text-gray-500">
                        {alert.customer || '-'}
                        {alert.trip ? ` · ${alert.trip}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          alert.level === 'red'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ALERT_LABEL[alert.kind]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-700">{alert.message}</td>
                    <td className="px-5 py-3 text-xs">
                      {alert.resolved_at ? (
                        <span className="text-gray-500">
                          Selesai · berlangsung {formatMinutes(minutes)}
                        </span>
                      ) : (
                        <span className="font-bold text-red-700">
                          Terbuka · {formatMinutes(minutes)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {alert.acknowledged_at ? (
                        <span className="text-emerald-700">
                          Ditangani {formatDateTime(alert.acknowledged_at)}
                        </span>
                      ) : canAck && !alert.resolved_at ? (
                        <button
                          type="button"
                          onClick={() => acknowledge(alert.id)}
                          className="rounded-lg bg-[#2563EB] px-3 py-1.5 font-bold text-white hover:bg-[#2563EB]/85"
                        >
                          Tandai Ditangani
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}