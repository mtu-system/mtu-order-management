-- Laporan "Monitoring Update" untuk customer (1 file per RFT).
-- Jam-jam perjalanan per unit yang belum tercatat. Diisi otomatis oleh cron
-- dari GPS + geofence (lib/trip-auto.ts) dan bisa dikoreksi manual oleh
-- Operational/Manager di halaman Update Customer (server action, service role).
--   pool_departed_at       = ATD Pool (keluar Pool MTU)
--   origin_arrived_at      = Arrival at Origin (tiba di lokasi muat)
--   destination_arrived_at = Arrival at Destination (tiba di lokasi bongkar)
--   monitoring_note        = catatan untuk kolom Remarks (mis. "Cover CDD")
-- Loading at Origin = finished_loading_at, Unloading at Destination =
-- finished_unloading_at, Arrival at MTU Pool = completed_at (sudah ada).

alter table public.order_trucks
  add column if not exists pool_departed_at timestamptz,
  add column if not exists origin_arrived_at timestamptz,
  add column if not exists destination_arrived_at timestamptz,
  add column if not exists monitoring_note text;

-- Policy deny_customer berlaku per tabel, jadi kolom baru otomatis ikut
-- tertutup untuk role customer.
