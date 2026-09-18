-- Menambal 3 lubang RLS yang ditemukan saat audit (lihat pg_policies export
-- 2026-09-18):
--
-- 1. profiles_select_authenticated (qual: true) meng-override policy yang
--    lebih ketat (profiles_select), jadi SIAPAPUN yang login -- termasuk
--    role 'pending' yang belum di-approve -- bisa baca full_name, email,
--    role, is_active SEMUA staff. Policy ini di-drop; profiles_select
--    (baris sendiri, atau manager lihat semua) sudah cukup.
--
-- 2. order_history & unit_history INSERT cuma cek auth.uid() IS NOT NULL,
--    tanpa cek changed_by = auth.uid() atau role. User apapun bisa nyuntik
--    baris riwayat palsu ke order manapun, ngaku sebagai user lain --
--    audit trail bisa dipalsukan. Diperbaiki supaya changed_by harus sama
--    dengan auth.uid() milik sendiri (tetap semua role boleh insert,
--    karena kode app memang insert history dari role manapun yang
--    melakukan aksi -- tapi sekarang tidak bisa mengatasnamakan user lain).
--
-- 3. order_change_requests INSERT (marketing_create_change_request) nggak
--    ada cek role -- ditambahkan supaya cuma role marketing/marketing_admin
--    yang bisa bikin change request.
--
-- Aman dijalankan berulang (pakai DROP POLICY IF EXISTS sebelum re-create).

-- 1) Cabut policy profiles yang bocor
drop policy if exists profiles_select_authenticated on public.profiles;

-- 2) order_history: wajib changed_by = auth.uid()
drop policy if exists "Authenticated users can insert order history" on public.order_history;
create policy order_history_insert_own
  on public.order_history
  for insert
  to authenticated
  with check (changed_by = auth.uid());

-- 2) unit_history: wajib changed_by = auth.uid()
drop policy if exists "Authenticated users can insert unit history" on public.unit_history;
create policy unit_history_insert_own
  on public.unit_history
  for insert
  to authenticated
  with check (changed_by = auth.uid());

-- 3) order_change_requests: cuma marketing/marketing_admin yang bisa insert
drop policy if exists marketing_create_change_request on public.order_change_requests;
create policy marketing_create_change_request
  on public.order_change_requests
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and get_my_role() = any (array['marketing'::text, 'marketing_admin'::text])
  );
