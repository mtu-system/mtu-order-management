'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    if (loading) return

    setLoading(true)

    try {
      const response = await fetch('/auth/signout', {
        method: 'POST',
      })

      if (response.ok || response.redirected) {
        window.location.href = '/login'
        return
      }
    } catch (error) {
      console.error('LOGOUT ERROR:', error)
    }

    setLoading(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {loading ? 'Keluar...' : 'Logout'}
      </button>

      {loading && (
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
            <p className="text-sm font-semibold text-gray-500">Keluar...</p>
          </div>
        </div>
      )}
    </>
  )
}