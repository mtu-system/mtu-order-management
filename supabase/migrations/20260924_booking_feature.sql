-- Fitur "Booking": Marketing bisa bikin order untuk kebutuhan di masa
-- depan (H-sekian). Operational cukup cek kapasitas (mumpuni/tidak +
-- breakdown internal/vendor) dulu -- BELUM isi detail truk (plat/driver).
-- Kalau mumpuni, Marketing approve manual, baru order masuk ke flow biasa
-- (waiting_unit -> Keputusan Unit -> Alokasi Unit -> HSE dst, seperti
-- order normal). Kalau tidak mumpuni, balik ke Marketing buat direvisi
-- (mirip flow partial/unavailable yang sudah ada) atau dibatalkan.
--
-- Breakdown internal/vendor dari cek kapasitas disimpan di activity_logs
-- (action 'BOOKING_CAPACITY_CHECK'), sama pola dengan 'UNIT_ALLOCATION'
-- yang sudah ada -- bukan kolom baru di orders.
--
-- Aman dijalankan berulang.

-- ==========================================
-- 1) KOLOM BARU DI orders
-- ==========================================

alter table public.orders
  add column if not exists is_booking boolean not null default false,
  add column if not exists booking_date date,
  add column if not exists booking_decision text,
  add column if not exists booking_decision_note text,
  add column if not exists booking_decided_by uuid references public.profiles(id),
  add column if not exists booking_decided_at timestamptz;

-- ==========================================
-- 2) STATUS BARU: booking_review, booking_confirmed, booking_rejected
-- ==========================================

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders add constraint orders_status_check
  check (
    status = any (
      array[
        'draft'::text,
        'waiting_unit'::text,
        'vendor_process'::text,
        'waiting_hse'::text,
        'ready_loading'::text,
        'ready_to_depart'::text,
        'pending'::text,
        'cancelled'::text,
        'booking_review'::text,
        'booking_confirmed'::text,
        'booking_rejected'::text
      ]
    )
  );

-- ==========================================
-- 3) Booking belum wajib punya PK/RFT (belum final saat masih booking).
--    Order non-booking tetap wajib isi salah satu seperti sebelumnya.
-- ==========================================

alter table public.orders drop constraint if exists orders_identity_required;

alter table public.orders add constraint orders_identity_required
  check (
    is_booking = true
    or (
      ((pk_number is not null) and (pk_number <> ''::text))
      or ((rft_tr_job is not null) and (rft_tr_job <> ''::text))
    )
  );