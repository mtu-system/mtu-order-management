# MTU Order Management — catatan untuk AI coding assistant

Proyek Next.js (App Router) + Supabase biasa, tidak ada API/struktur folder
non-standar. Lihat `README.md` untuk cara jalanin dev server, dan
`CLAUDE.md` untuk konteks arsitektur/keputusan desain proyek ini.

Catatan keamanan: semua mutasi data dipanggil langsung dari client
component lewat Supabase JS SDK (anon key) — otorisasi per-role hanya
ditegakkan lewat RLS policy di database, BUKAN oleh `requireRole()` di
kode (itu cuma nyembunyiin UI). Jangan asumsikan suatu aksi "aman" hanya
karena UI-nya membatasi role tertentu.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
