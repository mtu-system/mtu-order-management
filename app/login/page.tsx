'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2,
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('LOGIN ERROR:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-gray-200 bg-gray-50/70 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="min-h-screen bg-[#F9FAFB] lg:grid lg:grid-cols-[52%_1fr]">
      {/* LEFT — BRAND PANEL */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0E2451] lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-14">
        <div className="pointer-events-none absolute -right-36 -top-36 h-[420px] w-[420px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/[0.18] blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
            MT
          </div>
          <div>
            <p className="text-sm font-semibold text-white">MTU</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/60">
              Management System
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md text-center">
          <div className="mx-auto mb-8 flex h-[180px] w-[180px] items-center justify-center rounded-3xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
            <span className="text-4xl font-extrabold text-[#0E2451]">MT</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            MTU Order Management
          </h2>
          <p className="mx-auto mt-3.5 max-w-sm text-[13.5px] leading-6 text-blue-100/70">
            Internal Order Management System untuk mendukung proses
            pengelolaan order PT Mandiri Trans Utama.
          </p>

          <div className="mt-6 flex justify-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[11.5px] text-blue-100/80">
              <ShieldCheck className="h-3.5 w-3.5" />
              Internal System
            </span>
            <span className="rounded-full border border-white/15 px-3.5 py-1.5 text-[11.5px] text-blue-100/80">
              Secure Access
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] text-blue-200/40">
          <span>© {new Date().getFullYear()} Mandiri Trucking</span>
          <span>Internal use only</span>
        </div>
      </section>

      {/* RIGHT — LOGIN FORM */}
      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
            <Lock className="h-5 w-5 text-blue-600" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Selamat Datang
          </h1>
          <p className="mt-1.5 text-[13px] leading-6 text-gray-500">
            Login menggunakan akun kantor untuk mengakses MTU Order
            Management.
          </p>

          <form onSubmit={handleLogin} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@mandiritrans.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  aria-label={
                    showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-[16px] w-[16px]" />
                  ) : (
                    <Eye className="h-[16px] w-[16px]" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-[16px] w-[16px] shrink-0" />
                <div>
                  <p className="font-semibold">Login gagal</p>
                  <p className="mt-0.5 text-xs leading-5 text-red-600/80">
                    {error}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-gray-200 pt-5 text-[11px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Akses terbatas untuk pengguna internal MTU</span>
          </div>
          <p className="mt-3.5 text-center text-[10.5px] text-gray-400">
            PT Mandiri Trans Utama • Internal Order Management System
          </p>
        </div>
      </section>
    </main>
  )
}
