import { requireRole } from '@/lib/auth'

export default async function PendingPage() {
  const user = await requireRole(['pending'])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">
          Akun Belum Diaktifkan
        </h1>

        <p className="mt-3 text-sm text-gray-500">
          Halo, {user.full_name}.
        </p>

        <p className="mt-3 text-sm text-gray-500">
          Akun kamu sudah terdaftar, tetapi role belum
          ditentukan oleh administrator.
        </p>
      </div>
    </main>
  )
}