-- ==========================================
-- ARMADA & POOL
-- ==========================================
-- 1. Geofence boleh bertipe 'pool' (lokasi pool, mis. Pool Bekasi).
-- 2. Tabel unit_journey: status perjalanan per perangkat GPS (di pool,
--    dalam kota, luar kota, pulang, batal pulang). Hanya ditulis oleh cron
--    check-alerts (service role); staff Operational/Manager hanya membaca.
-- Aman dijalankan ulang.

-- 1) Tipe geofence
do $$
declare
  c record;
begin
  -- Hapus check constraint lama pada kolom type (namanya bisa beda-beda).
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'geofences'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%'
  loop
    execute format('alter table public.geofences drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.geofences
  add constraint geofences_type_check
  check (type in ('loading', 'unloading', 'other', 'pool'));

-- 2) Status perjalanan unit
create table if not exists public.unit_journey (
  imei text primary key,
  plate_key text,
  state text not null default 'city'
    check (state in ('pool', 'city', 'out_of_town', 'returning', 'reloaded')),
  region text,
  left_pool_at timestamptz,
  went_out_at timestamptz,
  returned_at timestamptz,
  reloaded_at timestamptz,
  reload_truck_id text,
  known_truck_ids text[] not null default '{}',
  dist_km double precision,
  ref_dist_km double precision,
  ref_at timestamptz,
  trend_km double precision,
  updated_at timestamptz not null default now()
);

alter table public.unit_journey enable row level security;

drop policy if exists unit_journey_read on public.unit_journey;
create policy unit_journey_read
  on public.unit_journey for select to authenticated
  using (public.get_my_role() = any (array['manager', 'operational']));

-- Tidak ada policy insert/update/delete: hanya service role (cron) yang menulis.
revoke insert, update, delete on public.unit_journey from anon, authenticated;
