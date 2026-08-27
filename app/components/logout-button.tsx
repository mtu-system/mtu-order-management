'use client'

import { useState } from 'react'

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
      className="w-full rounded-lg px-4 py-3 text-left text-sm text-gray-600 transition hover:bg-gray-100 hover:text-black disabled:opacity-50"
    >
      {loading ? 'Keluar...' : 'Logout'}
    </button>
  )
}