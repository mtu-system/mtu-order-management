# MTU Order Management — catatan untuk AI coding assistant

Proyek Next.js (App Router) + Supabase biasa, tidak ada API/struktur folder
non-standar. Lihat `README.md` untuk cara jalanin dev server, dan
`CLAUDE.md` untuk konteks arsitektur/keputusan desain proyek ini.

Catatan keamanan: semua mutasi data dipanggil langsung dari client
component lewat Supabase JS SDK (anon key) — otorisasi per-role hanya
ditegakkan lewat RLS policy di database, BUKAN oleh `requireRole()` di
kode (itu cuma nyembunyiin UI). Jangan asumsikan suatu aksi "aman" hanya
karena UI-nya membatasi role tertentu.
