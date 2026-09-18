-- Auto-maintain `updated_at` on every UPDATE for orders & order_trucks.
--
-- Kenapa: beberapa dashboard (Operational, HSE, Manager, Marketing) memfilter
-- order "yang masih relevan hari ini" dengan `updated_at.gte.<awal hari ini>`.
-- Tapi banyak tempat di kode yang mengubah status TIDAK ikut menyetel
-- `updated_at` secara manual, jadi filter itu jadi tidak bisa diandalkan
-- (order bisa langsung hilang dari dashboard padahal baru saja berubah).
--
-- Trigger ini membuat `updated_at` selalu ikut ter-refresh otomatis di level
-- database untuk SETIAP UPDATE pada baris orders/order_trucks, apapun kolom
-- yang diubah dan dari jalur mana pun (client langsung, RPC, dsb) -- jadi
-- kode aplikasi tidak perlu lagi rajin-rajin menyetel updated_at manual.
--
-- Aman dijalankan berulang (idempotent): CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.order_trucks;
create trigger set_updated_at
  before update on public.order_trucks
  for each row
  execute function public.set_updated_at();

-- Kalau tabel lain juga punya kolom updated_at dan mau ikut auto-maintained,
-- tinggal tambah blok yang sama:
--
-- drop trigger if exists set_updated_at on public.NAMA_TABEL;
-- create trigger set_updated_at
--   before update on public.NAMA_TABEL
--   for each row
--   execute function public.set_updated_at();
