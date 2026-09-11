// scripts/seed-dummy-users.mjs
//
// Bikin dummy user untuk testing role & permission (Marketing 1-5,
// Operational 1-5, HSE 1-5, Marketing Admin).
//
// CARA PAKAI:
//   1. Buka Supabase Dashboard -> Project Settings -> API
//   2. Copy "Project URL" dan "service_role" key (BUKAN anon key!)
//   3. Jalankan dari root project:
//
//        SUPABASE_URL="https://xxxx.supabase.co" \
//        SUPABASE_SERVICE_ROLE_KEY="xxxxxxxx" \
//        node scripts/seed-dummy-users.mjs
//
//   4. Script ini aman dijalankan berkali-kali (idempotent) -- kalau
//      user sudah ada, dia cuma update baris profiles-nya.
//
// PENTING: service_role key punya akses penuh, bypass semua RLS.
// JANGAN taruh key ini di kode/commit ke git. Cuma dipakai sekali
// jalan lewat terminal untuk seeding.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Set env SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dulu sebelum jalanin script ini.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Password sama untuk semua dummy user -- ini CUMA untuk testing,
// domain email juga sengaja pakai .local (fake) biar tidak ada
// email asli yang kesenggol.
const DEFAULT_PASSWORD = 'MtuTest2026!'

const users = [
  ...Array.from({ length: 5 }, (_, i) => ({
    email: `marketing${i + 1}@mtu-test.local`,
    full_name: `Marketing ${i + 1}`,
    role: 'marketing',
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    email: `operational${i + 1}@mtu-test.local`,
    full_name: `Operational ${i + 1}`,
    role: 'operational',
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    email: `hse${i + 1}@mtu-test.local`,
    full_name: `HSE ${i + 1}`,
    role: 'hse',
  })),
  {
    email: 'marketingadmin@mtu-test.local',
    full_name: 'Marketing Admin',
    role: 'marketing_admin',
  },
]

async function findExistingUserId(email) {
  // listUsers tidak punya filter by-email langsung di semua versi,
  // jadi kita paging manual (aman untuk jumlah user yang kecil).
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      console.error(`  -> gagal listUsers: ${error.message}`)
      return null
    }

    const found = data.users.find((u) => u.email === email)
    if (found) return found.id

    if (data.users.length < 200) return null
    page += 1
  }
}

async function run() {
  for (const u of users) {
    console.log(`\n${u.email} (${u.role})`)

    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: u.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      })

    let userId = created?.user?.id

    if (createError) {
      const alreadyExists = createError.message
        .toLowerCase()
        .includes('already been registered')

      if (!alreadyExists) {
        console.error(`  -> GAGAL bikin auth user: ${createError.message}`)
        continue
      }

      console.log('  -> auth user sudah ada, cari id-nya...')
      userId = await findExistingUserId(u.email)
    }

    if (!userId) {
      console.error(`  -> tidak dapat user id, skip ${u.email}.`)
      continue
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_active: true,
    })

    if (profileError) {
      console.error(`  -> gagal simpan profile: ${profileError.message}`)
    } else {
      console.log(`  -> OK. role = ${u.role}`)
    }
  }

  console.log('\n=========================================')
  console.log('Selesai.')
  console.log('Password semua dummy user:', DEFAULT_PASSWORD)
  console.log('=========================================')
}

run()
