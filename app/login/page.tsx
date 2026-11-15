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
  Check,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

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
    'h-[52px] w-full rounded-2xl border-[1.5px] border-[#D5DDEC] bg-white pl-12 pr-4 text-[14.5px] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-[#B8C4DC] focus:border-[#082868] focus:ring-4 focus:ring-[#082868]/10 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#C9DAF5] via-[#EEF3FC] via-45% to-[#FDEBED] px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-56 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(8,40,104,0.22),transparent_68%)]" />
      <svg
        viewBox="0 0 320 180"
        className="pointer-events-none absolute bottom-0 right-0 hidden h-[180px] w-[320px] sm:block"
        aria-hidden="true"
      >
        <path d="M320 40 C250 55 210 90 170 180 H320Z" fill="#082868" />
        <path
          d="M320 20 C265 28 225 52 196 92 C240 70 280 62 320 66Z"
          fill="#E30613"
        />
      </svg>

      <div className="relative flex w-full max-w-[1100px] overflow-hidden rounded-[32px] bg-white shadow-[0_40px_90px_rgba(8,40,104,0.2),0_4px_14px_rgba(8,40,104,0.06)]">
        {/* FORM */}
        <section className="flex min-w-0 flex-1 flex-col justify-center px-7 py-10 sm:px-14 lg:px-16">
          <div className="mb-6 flex items-center gap-3">
            <Image
              src="/mtu.png"
              alt="Mandiri Trucking"
              width={54}
              height={46}
              className="h-[46px] w-[54px] object-contain"
            />
            <div className="leading-none">
              <p className="text-[21px] font-extrabold tracking-tight text-[#082868]">
                MANDIRI
              </p>
              <p className="mt-[3px] text-[12.5px] font-extrabold tracking-[0.06em] text-[#082868]">
                TRANS UTAMA
              </p>
            </div>
          </div>

          <h1 className="text-[38px] font-extrabold leading-none tracking-tight text-[#082868]">
            MASUK
          </h1>
          <div className="mb-1 mt-3 h-[5px] w-14 rounded-full bg-[#E30613]" />
          <p className="mb-6 mt-2.5 text-[13.5px] text-slate-500">
            Gunakan akun kantor untuk membuka MTU Order Management.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-[#0F1E3D]"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Masukkan email perusahaan"
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
                className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.05em] text-[#0F1E3D]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  aria-label={
                    showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <label className="flex cursor-pointer select-none items-center gap-2.5 font-medium text-slate-700">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={remember}
                  aria-label="Ingat saya"
                  onClick={() => setRemember((value) => !value)}
                  className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] transition ${
                    remember
                      ? 'border-[#082868] bg-[#082868]'
                      : 'border-[#B8C4DC] bg-white'
                  }`}
                >
                  {remember && (
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
                  )}
                </button>
                Ingat saya
              </label>
              <span className="font-bold text-[#082868]">
                Lupa password? Hubungi admin
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
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
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#0B3C94] to-[#082868] text-[15px] font-bold tracking-[0.08em] text-white shadow-[0_12px_26px_rgba(8,40,104,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(8,40,104,0.38)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  MEMPROSES...
                </>
              ) : (
                'MASUK'
              )}
            </button>
          </form>

          <div className="mt-5 rounded-2xl bg-[#F1F4FA] px-3 py-3 text-center text-[13px] text-slate-600">
            Belum punya akun?{' '}
            <span className="font-bold text-[#082868]">Hubungi admin</span>
          </div>
        </section>

        {/* FOTO ARMADA */}
        <section className="relative hidden w-[500px] shrink-0 overflow-hidden bg-gradient-to-b from-[#0A3487] to-[#061C4A] lg:block">
          <Image
            src="/login-trucks.jpg"
            alt="Armada truk Mandiri Trans Utama"
            width={624}
            height={486}
            priority
            className="absolute bottom-0 left-0 h-auto w-full [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_42%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_42%)]"
          />
          <div className="absolute inset-x-11 top-12 text-white">
            <p className="text-[30px] font-extrabold leading-[1.18] tracking-tight">
              Kirim lebih tenang,
              <br />
              pantau lebih dekat.
            </p>
            <div className="mt-3.5 flex">
              <span className="h-1 w-[46px] rounded-l-full bg-[#E30613]" />
              <span className="h-1 w-[46px] rounded-r-full bg-white" />
            </div>
            <p className="mt-3.5 text-[13px] font-medium italic text-white/90">
              Safety • Quality • Integrity • Consistency • Efficiency
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}