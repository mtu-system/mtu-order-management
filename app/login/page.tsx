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
    'h-11 w-full rounded-md border border-[#D0D5DD] bg-white pl-11 pr-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-[#B8C4DC] focus:border-[#082868] focus:ring-2 focus:ring-[#082868]/10 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] px-4 py-10">

      <div className="flex w-full max-w-[1000px] overflow-hidden rounded-[10px] border border-[#E3E6EB] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
        {/* FORM */}
        <section className="flex min-w-0 flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
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

          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-slate-900">
            Masuk
          </h1>
          <div className="mb-1 mt-2.5 h-[3px] w-10 bg-[#E30613]" />
          <p className="mb-6 mt-2.5 text-[13.5px] text-slate-500">
            Gunakan akun kantor untuk membuka MTU Order Management.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-[12.5px] font-semibold text-slate-700"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                  className={`flex h-5 w-5 items-center justify-center rounded border-[1.5px] transition ${
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
              <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#082868] text-[14px] font-semibold text-white transition hover:bg-[#0b3486] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <div className="mt-5 rounded-md border border-[#E3E6EB] bg-[#F8F9FB] px-3 py-2.5 text-center text-[13px] text-slate-600">
            Belum punya akun?{' '}
            <span className="font-bold text-[#082868]">Hubungi admin</span>
          </div>
        </section>

        {/* FOTO ARMADA */}
        <section className="relative hidden w-[460px] shrink-0 overflow-hidden bg-[#082868] lg:block">
          <Image
            src="/login-trucks.jpg"
            alt="Armada truk Mandiri Trans Utama"
            width={624}
            height={486}
            priority
            className="absolute bottom-0 left-0 h-auto w-full [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_42%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_42%)]"
          />
          <div className="absolute inset-x-11 top-12 text-white">
            <p className="text-[26px] font-bold leading-[1.2] tracking-tight">
              Kirim lebih tenang,
              <br />
              pantau lebih dekat.
            </p>
            <div className="mt-3.5 flex">
              <span className="h-[3px] w-10 bg-[#E30613]" />
              <span className="h-[3px] w-10 bg-white" />
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