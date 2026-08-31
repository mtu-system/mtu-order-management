'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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

  return (
    <main className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-2">
      {/* =========================================================
          LEFT — BRAND PANEL
      ========================================================= */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#031f5f] lg:flex">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.25),transparent_35%)]" />

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* Decorative circles */}
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/[0.06]" />

        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex w-full flex-col justify-between px-14 py-12 xl:px-20">
          {/* Top brand */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 shadow-lg backdrop-blur-sm">
                <Image
                  src="/mtu.png"
                  alt="Mandiri Trucking"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </div>

              <div>
                <p className="text-sm font-semibold tracking-wide text-white">
                  MTU
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/60">
                  Management System
                </p>
              </div>
            </div>
          </div>

          {/* Main branding */}
          <div className="mx-auto w-full max-w-lg">
            <div className="mb-9 flex justify-center">
              <div className="relative">
                {/* Glow */}
                <div className="absolute inset-0 rounded-[28px] bg-white/20 blur-2xl" />

                {/* Logo container */}
                <div className="relative flex h-52 w-52 items-center justify-center rounded-[28px] border border-white/20 bg-white p-7 shadow-[0_24px_70px_rgba(0,0,0,0.30)]">
                  <Image
                    src="/mtu.png"
                    alt="Mandiri Trucking"
                    width={190}
                    height={150}
                    className="h-auto w-full object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
                MTU Order Management
              </h2>

              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-blue-100/65">
                Internal Order Management System untuk mendukung proses
                pengelolaan order PT Mandiri Trans Utama.
              </p>
            </div>

            {/* Small feature badges */}
            <div className="mt-8 flex justify-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs text-blue-100/75 backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5" />
                Internal System
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs text-blue-100/75 backdrop-blur-sm">
                Secure Access
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-blue-200/40">
            <span>
              © {new Date().getFullYear()} Mandiri Trucking
            </span>

            <span>Internal use only</span>
          </div>
        </div>
      </section>

      {/* =========================================================
          RIGHT — LOGIN
      ========================================================= */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fa] px-6 py-10 sm:px-10">
        {/* Mobile decorative background */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex justify-center lg:hidden">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <Image
                src="/mtu.png"
                alt="Mandiri Trucking"
                width={100}
                height={80}
                className="h-auto w-full object-contain"
                priority
              />
            </div>
          </div>

          {/* Login card */}
          <div className="rounded-3xl border border-gray-200/80 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
            {/* Heading */}
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#01236A]/[0.07]">
                <Lock className="h-5 w-5 text-[#01236A]" />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-950">
                Selamat Datang
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Login menggunakan akun kantor untuk mengakses MTU Order
                Management.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-gray-500"
                >
                  Email
                </label>

                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#01236A]" />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@mandiritrans.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-300 focus:border-[#01236A] focus:bg-white focus:ring-4 focus:ring-[#01236A]/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-gray-500"
                >
                  Password
                </label>

                <div className="group relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#01236A]" />

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-10 pr-12 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:border-gray-300 focus:border-[#01236A] focus:bg-white focus:ring-4 focus:ring-[#01236A]/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? 'Sembunyikan password'
                        : 'Tampilkan password'
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:pointer-events-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[17px] w-[17px]" />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-[17px] w-[17px] shrink-0" />

                  <div>
                    <p className="font-semibold">Login gagal</p>
                    <p className="mt-0.5 text-xs leading-5 text-red-600/80">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#01236A] px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(1,35,106,0.20)] transition-all hover:bg-[#062b7c] hover:shadow-[0_10px_25px_rgba(1,35,106,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
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

            {/* Security note */}
            <div className="mt-7 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Akses terbatas untuk pengguna internal MTU</span>
              </div>
            </div>
          </div>

          {/* Bottom text */}
          <p className="mt-6 text-center text-[11px] text-gray-400">
            PT Mandiri Trans Utama • Internal Order Management System
          </p>
        </div>
      </section>
    </main>
  )
}