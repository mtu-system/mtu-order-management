'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/app/components/toast-provider'

type OpenAlert = {
  id: string
  plate: string
  level: 'red' | 'amber'
  message: string
  acknowledged_at: string | null
}

const POLL_MS = 30_000

export default function AlertWatcher() {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const notified = useRef(new Set<string>())
  const audioRef = useRef<AudioContext | null>(null)

  // Browser baru mengizinkan suara setelah pengguna berinteraksi.
  useEffect(() => {
    function unlock() {
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext()
        } catch {
          return
        }
      }
      audioRef.current.resume?.()
    }

    window.addEventListener('click', unlock)
    window.addEventListener('keydown', unlock)

    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    function beep() {
      const context = audioRef.current
      if (!context || context.state !== 'running') return

      for (let i = 0; i < 3; i++) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.frequency.value = 880
        gain.gain.value = 0.15
        oscillator.connect(gain)
        gain.connect(context.destination)

        const start = context.currentTime + i * 0.4
        oscillator.start(start)
        oscillator.stop(start + 0.25)
      }
    }

    async function poll() {
      try {
        if (document.hidden) return
        const response = await fetch('/api/alerts', { cache: 'no-store' })

        // 403 / bukan Operational: berhenti memeriksa. 401 (belum login): coba lagi nanti.
        if (response.status === 403) {
          if (timer) clearInterval(timer)
          return
        }
        if (!response.ok || !alive) return

        const json = await response.json()

        if (!json.notify) {
          if (timer) clearInterval(timer)
          return
        }

        const fresh = (json.alerts as OpenAlert[]).filter(
          (alert) =>
            alert.level === 'red' &&
            !alert.acknowledged_at &&
            !notified.current.has(alert.id)
        )

        if (fresh.length > 0) {
          for (const alert of fresh) {
            notified.current.add(alert.id)
            toastRef.current.error(`Peringatan ${alert.plate}`, alert.message)
          }
          beep()
        }
      } catch {
        // abaikan, coba lagi di putaran berikutnya
      }
    }

    poll()
    timer = setInterval(poll, POLL_MS)

    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
  }, [])

  return null
}