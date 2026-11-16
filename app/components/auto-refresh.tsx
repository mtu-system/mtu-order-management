'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Muat ulang data server component secara berkala (tab tersembunyi dilewati).
export default function AutoRefresh({ ms = 60_000 }: { ms?: number }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh()
    }, ms)
    return () => clearInterval(timer)
  }, [router, ms])

  return null
}
