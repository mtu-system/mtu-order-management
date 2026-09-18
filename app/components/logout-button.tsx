'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)

    const response = await fetch('/auth/signout', {
      method: 'POST',
    })

    if (response.ok || response.redirected) {
      window.location.href = '/login'
      return
    }

    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {loading ? 'Keluar...' : 'Logout'}
    </button>
  )
}