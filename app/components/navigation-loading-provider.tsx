'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type NavigationLoadingContextValue = {
  isLoading: boolean
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>(
  { isLoading: false }
)

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext)
}

export default function NavigationLoadingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Begitu URL (pathname/query) beneran berubah, berarti halaman baru udah
  // kepasang -- matikan loading.
  useEffect(() => {
    setIsLoading(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [pathname, searchParams])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Klik kanan / ctrl+klik / dsb -- biarin browser handle sendiri.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const anchor = (event.target as HTMLElement)?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      // Cuma link internal (bukan ke domain lain, bukan _blank, bukan file
      // download).
      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return
      }

      const url = new URL(href, window.location.origin)
      const isSamePage =
        url.pathname === window.location.pathname &&
        url.search === window.location.search

      if (isSamePage) return

      setIsLoading(true)

      // Jaga-jaga kalau navigasi gagal/macet -- jangan sampai overlay
      // nyangkut selamanya.
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsLoading(false), 10000)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return (
    <NavigationLoadingContext.Provider value={{ isLoading }}>
      {children}

      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-lg">
            <svg
              className="h-7 w-7 animate-spin text-[#2563EB]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-semibold text-gray-500">Memuat...</p>
          </div>
        </div>
      )}
    </NavigationLoadingContext.Provider>
  )
}