-- Index buat kolom yang paling sering dipakai filter/sort/join di seluruh
-- app (dashboard, daftar order, history, booking report, dst). Sebelum
-- ini, gak ada satupun index selain primary key -- jadi tiap query yang
-- nge-filter status/tanggal/pembuat, atau join ke order_trucks/
-- order_requirements/order_history/dst, full table scan. Makin banyak
-- order numpuk, makin lambat.
--
-- Aman dijalankan berulang (IF NOT EXISTS di semua index).

-- ==========================================
-- orders -- kolom yang paling sering di-filter/sort/scope-per-user
-- ==========================================

create index if not exists idx_orders_status
  on public.orders (status);

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_orders_created_by
  on public.orders (created_by);

create index if not exists idx_orders_is_booking
  on public.orders (is_booking)
  where is_booking = true;

create index if not exists idx_orders_booking_date
  on public.orders (booking_date desc);

create index if not exists idx_orders_pk_number
  on public.orders (pk_number)
  where pk_number is not null;

-- ==========================================
-- Tabel anak order -- semuanya di-join/filter lewat order_id
-- ==========================================

create index if not exists idx_order_requirements_order_id
  on public.order_requirements (order_id);

create index if not exists idx_order_trucks_order_id
  on public.order_trucks (order_id);

create index if not exists idx_order_trucks_status
  on public.order_trucks (status);

create index if not exists idx_order_history_order_id
  on public.order_history (order_id);

create index if not exists idx_unit_history_order_id
  on public.unit_history (order_id);

create index if not exists idx_activity_logs_order_id
  on public.activity_logs (order_id);

create index if not exists idx_activity_logs_action
  on public.activity_logs (action);

create index if not exists idx_order_change_requests_order_id
  on public.order_change_requests (order_id);

create index if not exists idx_order_change_requests_status
  on public.order_change_requests (status);