-- Lokasi muat & bongkar per order (dipilih Marketing saat Create Order) supaya
-- semua jam laporan Monitoring Update bisa terisi otomatis dari GPS.
--   orders.origin_fence_id        = geofence lokasi muat (berlaku semua unit)
--   orders.destination_fence_id   = geofence lokasi bongkar (berlaku semua unit)
--   order_trucks.origin_fence_id  = override lokasi muat per unit (opsional)
--   order_trucks.destination_fence_id sudah ada = override lokasi bongkar per unit
--   order_trucks.gps_times_filled_at = kapan jam unit terakhir diisi dari
--     riwayat rute GPS (supaya cron tidak mengulang terus).

alter table public.orders
  add column if not exists origin_fence_id uuid references public.geofences(id) on delete set null,
  add column if not exists destination_fence_id uuid references public.geofences(id) on delete set null;

alter table public.order_trucks
  add column if not exists origin_fence_id uuid references public.geofences(id) on delete set null,
  add column if not exists gps_times_filled_at timestamptz;

create index if not exists orders_origin_fence_idx on public.orders (origin_fence_id);
create index if not exists orders_destination_fence_idx on public.orders (destination_fence_id);

-- Unit baru otomatis mengikuti lokasi order (kecuali sudah diisi sendiri).
create or replace function public.order_trucks_default_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o_origin uuid;
  o_destination uuid;
begin
  if new.origin_fence_id is null or new.destination_fence_id is null then
    select origin_fence_id, destination_fence_id
      into o_origin, o_destination
      from public.orders
     where id = new.order_id;
    new.origin_fence_id := coalesce(new.origin_fence_id, o_origin);
    new.destination_fence_id := coalesce(new.destination_fence_id, o_destination);
  end if;
  return new;
end;
$$;

drop trigger if exists order_trucks_default_locations on public.order_trucks;
create trigger order_trucks_default_locations
  before insert on public.order_trucks
  for each row execute function public.order_trucks_default_locations();

-- Lokasi order diubah -> unit yang masih kosong / masih sama dengan lokasi
-- lama ikut berubah (override per unit dibiarkan).
create or replace function public.orders_propagate_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origin_fence_id is distinct from old.origin_fence_id then
    update public.order_trucks
       set origin_fence_id = new.origin_fence_id
     where order_id = new.id
       and (origin_fence_id is null or origin_fence_id is not distinct from old.origin_fence_id);
  end if;
  if new.destination_fence_id is distinct from old.destination_fence_id then
    update public.order_trucks
       set destination_fence_id = new.destination_fence_id
     where order_id = new.id
       and (destination_fence_id is null or destination_fence_id is not distinct from old.destination_fence_id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_propagate_locations on public.orders;
create trigger orders_propagate_locations
  after update of origin_fence_id, destination_fence_id on public.orders
  for each row execute function public.orders_propagate_locations();

revoke execute on function public.order_trucks_default_locations() from public, anon, authenticated;
revoke execute on function public.orders_propagate_locations() from public, anon, authenticated;
