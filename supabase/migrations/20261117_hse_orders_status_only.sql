-- HSE hanya boleh mengubah status order.
--
-- HSE perlu UPDATE orders karena syncOrderStatus (lib/sync-order-status.ts)
-- dipanggil dari form inspeksi dan menyetel orders.status (plus
-- departure_ready_at saat semua unit Ready to Depart). Policy UPDATE yang ada
-- tidak membatasi kolom, jadi HSE bisa mengubah customer, PK, trip, dst.
-- Trigger ini menolak perubahan kolom lain oleh role HSE.
-- Service role / cron (auth.uid() null -> get_my_role() null) tidak terpengaruh.

create or replace function public.orders_hse_status_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['status', 'departure_ready_at', 'updated_at'];
begin
  if public.get_my_role() = 'hse'
     and (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'HSE hanya boleh mengubah status order'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_hse_status_only on public.orders;
create trigger orders_hse_status_only
  before update on public.orders
  for each row
  execute function public.orders_hse_status_only();
