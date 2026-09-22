-- Role baru 'vm' (Vendor Management).
--
-- Konteks: unit vendor sudah lama bisa dibuat lewat 2 jalur yang sudah ada
-- (unit-allocation-form.tsx saat alokasi awal, failed-unit-resolution.tsx
-- saat unit failed dialihkan ke vendor) -- keduanya insert/update
-- order_trucks dengan source='vendor', status='vm', TAPI vendor_name selalu
-- di-hardcode 'Vendor / VM' dan plate_number/driver_name/driver_phone selalu
-- NULL. Sampai sekarang tidak ada UI sama sekali untuk melengkapi data itu.
--
-- Role 'vm' ini HANYA untuk melengkapi 4 field tersebut pada unit vendor
-- yang sudah ada -- tidak membuat order/unit baru, tidak mengubah data lain.
--
-- Aman dijalankan berulang (pakai DROP POLICY/FUNCTION IF EXISTS sebelum
-- re-create), sesuai konvensi migration lain di folder ini.

-- ==========================================
-- 1) RLS SELECT: VM boleh lihat unit vendor (order_trucks) dan order terkait
--    (untuk konteks customer/PK/RFT/trip) -- read-only untuk order, dan
--    read-only juga untuk order_trucks lewat RLS (tulisnya lewat RPC di
--    bawah, bukan lewat UPDATE langsung).
-- ==========================================

drop policy if exists order_trucks_select_vm on public.order_trucks;
create policy order_trucks_select_vm
  on public.order_trucks
  for select
  to authenticated
  using (
    public.get_my_role() = 'vm'
    and source = 'vendor'
  );

drop policy if exists orders_select_vm on public.orders;
create policy orders_select_vm
  on public.orders
  for select
  to authenticated
  using (
    public.get_my_role() = 'vm'
    and exists (
      select 1 from public.order_trucks
      where order_trucks.order_id = orders.id
        and order_trucks.source = 'vendor'
    )
  );

-- ==========================================
-- 2) RPC vm_fill_vendor_unit -- satu-satunya jalan VM menulis data, supaya
--    field yang bisa diubah dan validasinya terkontrol di satu tempat
--    (konsisten dengan pola approve_add_unit_request dkk di migration
--    sebelumnya), bukan lewat UPDATE RLS langsung yang lebih longgar.
-- ==========================================

create or replace function public.vm_fill_vendor_unit(
  p_truck_id uuid,
  p_vendor_name text,
  p_plate_number text,
  p_driver_name text,
  p_driver_phone text,
  p_no_buntut text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.get_my_role() <> 'vm' then
    raise exception 'Anda tidak memiliki izin untuk mengisi detail unit vendor ini.';
  end if;

  if coalesce(trim(p_vendor_name), '') = '' then
    raise exception 'Nama PT Vendor wajib diisi.';
  end if;

  if coalesce(trim(p_plate_number), '') = '' then
    raise exception 'No. unit wajib diisi.';
  end if;

  if coalesce(trim(p_driver_name), '') = '' then
    raise exception 'Nama driver wajib diisi.';
  end if;

  if coalesce(trim(p_driver_phone), '') = '' then
    raise exception 'No. telepon driver wajib diisi.';
  end if;

  update public.order_trucks
  set
    vendor_name = trim(p_vendor_name),
    plate_number = trim(p_plate_number),
    driver_name = trim(p_driver_name),
    driver_phone = trim(p_driver_phone),
    no_buntut = nullif(trim(coalesce(p_no_buntut, '')), ''),
    updated_at = now()
  where id = p_truck_id
    and source = 'vendor'
    and status not in ('cancelled', 'departed', 'finished');

  if not found then
    raise exception 'Unit vendor tidak ditemukan atau sudah tidak aktif.';
  end if;
end;
$function$;

grant execute on function public.vm_fill_vendor_unit(uuid, text, text, text, text, text) to authenticated;
