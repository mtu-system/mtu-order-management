-- Tambah 'inspection' ke orders_status_check.
--
-- Bug: syncOrderStatus (lib/sync-order-status.ts) menyetel
-- orders.status = 'inspection' saat ada unit yang sedang diinspeksi HSE,
-- tapi constraint dari 20260924_booking_feature.sql tidak memuat nilai itu.
-- Update-nya ditolak database dan hanya tercatat di console.error, jadi
-- status order nyangkut di tahap sebelumnya selama inspeksi berlangsung.
--
-- Aman dijalankan berulang.

alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders add constraint orders_status_check
  check (
    status = any (
      array[
        'draft'::text,
        'waiting_unit'::text,
        'vendor_process'::text,
        'waiting_hse'::text,
        'inspection'::text,
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
