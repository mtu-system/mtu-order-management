import { createClient } from '@supabase/supabase-js'

// HANYA untuk kode server (route handler). Melewati RLS.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Env SUPABASE_SERVICE_ROLE_KEY belum diisi.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}