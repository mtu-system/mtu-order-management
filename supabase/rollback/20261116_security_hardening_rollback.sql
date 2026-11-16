-- ROLLBACK untuk supabase/migrations/20261116_security_hardening.sql
--
-- HANYA untuk jaga-jaga kalau hardening merusak alur aplikasi. Menjalankan
-- file ini MEMBUKA KEMBALI lubang keamanan yang ditambal (RPC lolos untuk
-- user nonaktif, policy mengabaikan is_active, alert bisa ditutup lewat SDK,
-- riwayat bisa disuntik user pending). Setelah rollback, perbaiki masalahnya
-- lalu jalankan ulang migration hardening secepatnya.
--
-- Sengaja disimpan di luar supabase/migrations/ supaya tidak ikut ter-apply.
--
-- Semua policy dikembalikan persis seperti export pg_policies 2026-11-16, dan
-- RPC persis seperti di 20260918_fix_rpc_missing_role_checks.sql dan
-- 20260922_vm_role.sql.
--
-- TIDAK di-rollback: `enable row level security` (bagian 0). Status RLS
-- sebelum migration tidak diketahui, dan mematikan RLS akan membuka tabel
-- untuk anon key. Kalau memang perlu, lakukan manual per tabel:
--   alter table public.<tabel> disable row level security;
--
-- Aman dijalankan berulang.

-- ==========================================
-- 1) Policy berbasis profiles.role (versi lama)
-- ==========================================
drop policy if exists gps_links_read on public.gps_device_links;
create policy gps_links_read
  on public.gps_device_links for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['manager', 'marketing', 'marketing_admin', 'operational', 'hse'])
  ));

drop policy if exists gps_links_write on public.gps_device_links;
create policy gps_links_write
  on public.gps_device_links for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ));

drop policy if exists geofences_read on public.geofences;
create policy geofences_read
  on public.geofences for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = any (array['manager', 'marketing', 'marketing_admin', 'operational', 'hse'])
  ));

drop policy if exists geofences_write on public.geofences;
create policy geofences_write
  on public.geofences for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ));

drop policy if exists unit_alerts_read on public.unit_alerts;
create policy unit_alerts_read
  on public.unit_alerts for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational', 'hse'])
  ));

drop policy if exists operational_view_change_request on public.order_change_requests;
create policy operational_view_change_request
  on public.order_change_requests for select to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'operational'
  ));

drop policy if exists operational_update_change_request on public.order_change_requests;
create policy operational_update_change_request
  on public.order_change_requests for update to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'operational' and profiles.is_active = true
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'operational' and profiles.is_active = true
  ));

-- ==========================================
-- 2) unit_alerts: update semua kolom (versi lama)
-- ==========================================
drop policy if exists unit_alerts_ack on public.unit_alerts;
create policy unit_alerts_ack
  on public.unit_alerts for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['manager', 'operational'])
  ));

-- Kembalikan grant default Supabase (update semua kolom).
grant update on public.unit_alerts to anon, authenticated;

-- ==========================================
-- 3) Riwayat & activity log (versi lama)
-- ==========================================
drop policy if exists order_history_insert_own on public.order_history;
create policy order_history_insert_own
  on public.order_history for insert to authenticated
  with check (changed_by = auth.uid());

drop policy if exists unit_history_insert_own on public.unit_history;
create policy unit_history_insert_own
  on public.unit_history for insert to authenticated
  with check (changed_by = auth.uid());

drop policy if exists activity_logs_insert_authenticated on public.activity_logs;
create policy activity_logs_insert_authenticated
  on public.activity_logs for insert to authenticated
  with check (user_id = auth.uid());

-- ==========================================
-- 4) RPC versi lama
-- ==========================================

CREATE OR REPLACE FUNCTION public.approve_add_unit_request(p_request_id uuid, p_units jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order_id uuid;
  v_requested_quantity integer;
  v_current_quantity integer;
  v_unit_count integer;
  v_unit jsonb;
  v_vehicle_type text;
  v_requirement_quantity integer;
begin
  if public.get_my_role() <> 'operational' then
    raise exception 'Anda tidak memiliki izin untuk memproses perubahan ini.';
  end if;

  select order_id, requested_quantity
  into v_order_id, v_requested_quantity
  from public.order_change_requests
  where id = p_request_id and status = 'pending';

  if v_order_id is null then
    raise exception 'Change request tidak ditemukan atau sudah diproses.';
  end if;

  v_unit_count := jsonb_array_length(p_units);

  if v_unit_count <> v_requested_quantity then
    raise exception 'Jumlah unit yang dimasukkan (%) tidak sesuai request (%).', v_unit_count, v_requested_quantity;
  end if;

  select quantity into v_current_quantity
  from public.orders where id = v_order_id for update;

  if v_current_quantity is null then
    raise exception 'Order tidak ditemukan.';
  end if;

  v_vehicle_type := null;

  for v_unit in select value from jsonb_array_elements(p_units)
  loop
    if coalesce(trim(v_unit->>'vehicle_type'), '') = '' then
      raise exception 'Jenis kendaraan wajib diisi.';
    end if;

    if v_vehicle_type is null then
      v_vehicle_type := trim(v_unit->>'vehicle_type');
    end if;

    if coalesce(trim(v_unit->>'plate_number'), '') = '' then
      raise exception 'Plat nomor wajib diisi.';
    end if;

    if coalesce(trim(v_unit->>'driver_name'), '') = '' then
      raise exception 'Nama driver wajib diisi.';
    end if;

    if coalesce(trim(v_unit->>'driver_phone'), '') = '' then
      raise exception 'No. HP driver wajib diisi.';
    end if;

    if coalesce(v_unit->>'source', '') not in ('internal', 'vendor') then
      raise exception 'Source unit harus internal atau vendor.';
    end if;

    if v_unit->>'source' = 'vendor' and coalesce(trim(v_unit->>'vendor_name'), '') = '' then
      raise exception 'Nama vendor wajib diisi untuk unit vendor.';
    end if;

    insert into public.order_trucks (
      order_id, source, vehicle_type, no_buntut, plate_number,
      driver_name, driver_phone, vendor_name, status, trip
    )
    values (
      v_order_id,
      v_unit->>'source',
      trim(v_unit->>'vehicle_type'),
      nullif(trim(v_unit->>'no_buntut'), ''),
      trim(v_unit->>'plate_number'),
      trim(v_unit->>'driver_name'),
      trim(v_unit->>'driver_phone'),
      case when v_unit->>'source' = 'vendor' then nullif(trim(v_unit->>'vendor_name'), '') else null end,
      'waiting_hse',
      (select trip from public.orders where id = v_order_id)
    );
  end loop;

  update public.orders
  set quantity = quantity + v_requested_quantity, updated_at = now()
  where id = v_order_id;

  if v_vehicle_type is not null then
    select quantity into v_requirement_quantity
    from public.order_requirements
    where order_id = v_order_id and lower(vehicle_type) = lower(v_vehicle_type)
    order by quantity desc limit 1 for update;

    if v_requirement_quantity is null then
      insert into public.order_requirements (order_id, vehicle_type, quantity)
      values (v_order_id, v_vehicle_type, v_requested_quantity);
    else
      update public.order_requirements
      set quantity = v_requirement_quantity + v_requested_quantity
      where order_id = v_order_id and lower(vehicle_type) = lower(v_vehicle_type);
    end if;

    perform public.adjust_allocation_snapshot(v_order_id, v_vehicle_type, v_requested_quantity, 0);
  end if;

  update public.order_change_requests set status = 'approved' where id = p_request_id;
end;
$function$;

-- ==========================================
-- 3) approve_reduce_unit_request -- tambah cek role operational
-- ==========================================
CREATE OR REPLACE FUNCTION public.approve_reduce_unit_request(p_request_id uuid, p_selected_truck_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order_id uuid;
  v_requested_quantity integer;
  v_current_quantity integer;
  v_selected_count integer;
  v_pending_count integer;
  v_vehicle_type text;
  v_requirement_quantity integer;
begin
  if public.get_my_role() <> 'operational' then
    raise exception 'Anda tidak memiliki izin untuk memproses perubahan ini.';
  end if;

  select order_id, requested_quantity
  into v_order_id, v_requested_quantity
  from public.order_change_requests
  where id = p_request_id and status = 'pending';

  if v_order_id is null then
    raise exception 'Change request tidak ditemukan atau sudah diproses.';
  end if;

  v_selected_count := coalesce(array_length(p_selected_truck_ids, 1), 0);

  if v_selected_count <> v_requested_quantity then
    raise exception 'Jumlah unit yang dipilih (% ) tidak sesuai request (%).', v_selected_count, v_requested_quantity;
  end if;

  select quantity into v_current_quantity
  from public.orders where id = v_order_id for update;

  if v_current_quantity is null then
    raise exception 'Order tidak ditemukan.';
  end if;

  if v_requested_quantity >= v_current_quantity then
    raise exception 'Jumlah pengurangan tidak boleh menghabiskan seluruh order.';
  end if;

  select count(*), max(vehicle_type)
  into v_pending_count, v_vehicle_type
  from public.order_trucks
  where id = any(p_selected_truck_ids)
    and order_id = v_order_id
    and status not in ('cancelled', 'departed');

  if v_pending_count <> v_selected_count then
    raise exception 'Ada unit yang tidak valid, bukan milik order ini, atau sudah tidak aktif.';
  end if;

  update public.order_trucks
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = any(p_selected_truck_ids) and order_id = v_order_id;

  update public.orders
  set quantity = quantity - v_requested_quantity, updated_at = now()
  where id = v_order_id;

  if v_vehicle_type is not null then
    select quantity into v_requirement_quantity
    from public.order_requirements
    where order_id = v_order_id and lower(vehicle_type) = lower(v_vehicle_type)
    order by quantity desc limit 1 for update;

    if v_requirement_quantity is not null then
      if v_requirement_quantity - v_requested_quantity <= 0 then
        delete from public.order_requirements
        where order_id = v_order_id and lower(vehicle_type) = lower(v_vehicle_type);
      else
        update public.order_requirements
        set quantity = v_requirement_quantity - v_requested_quantity
        where order_id = v_order_id and lower(vehicle_type) = lower(v_vehicle_type);
      end if;
    end if;

    perform public.adjust_allocation_snapshot(v_order_id, v_vehicle_type, -v_requested_quantity, 0);
  end if;

  update public.order_change_requests set status = 'approved' where id = p_request_id;
end;
$function$;

-- ==========================================
-- 4) approve_change_vehicle_request (versi yang dipakai kode) -- tambah cek
--    role operational
-- ==========================================
CREATE OR REPLACE FUNCTION public.approve_change_vehicle_request(p_request_id uuid, p_selected_truck_ids uuid[], p_replacement_units jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE
  v_order_id uuid;
  v_requested_quantity integer;
  v_requested_vehicle_type text;
  v_old_vehicle_type text;
  v_selected_count integer;
  v_replacement_count integer;
  v_unit jsonb;
  v_source text;
  v_old_requirement_quantity integer;
  v_new_requirement_quantity integer;
  v_old_internal_count integer;
  v_old_vendor_count integer;
  v_new_internal_count integer := 0;
  v_new_vendor_count integer := 0;
BEGIN
  IF public.get_my_role() <> 'operational' THEN
    RAISE EXCEPTION 'Anda tidak memiliki izin untuk memproses perubahan ini.';
  END IF;

  SELECT order_id, requested_quantity, requested_vehicle_type
  INTO v_order_id, v_requested_quantity, v_requested_vehicle_type
  FROM public.order_change_requests
  WHERE id = p_request_id AND change_type = 'change_vehicle' AND status = 'pending'
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Request ganti jenis unit tidak ditemukan atau sudah diproses.';
  END IF;

  IF v_requested_quantity IS NULL OR v_requested_quantity <= 0 THEN
    RAISE EXCEPTION 'Jumlah unit penggantian tidak valid.';
  END IF;

  v_selected_count := COALESCE(array_length(p_selected_truck_ids, 1), 0);
  v_replacement_count := COALESCE(jsonb_array_length(p_replacement_units), 0);

  IF v_selected_count <> v_requested_quantity THEN
    RAISE EXCEPTION 'Jumlah unit lama yang dipilih harus % unit.', v_requested_quantity;
  END IF;

  IF v_replacement_count <> v_requested_quantity THEN
    RAISE EXCEPTION 'Detail unit pengganti harus berjumlah % unit.', v_requested_quantity;
  END IF;

  IF NULLIF(TRIM(v_requested_vehicle_type), '') IS NULL THEN
    RAISE EXCEPTION 'Jenis kendaraan baru belum ditentukan.';
  END IF;

  SELECT MAX(vehicle_type) INTO v_old_vehicle_type
  FROM public.order_trucks
  WHERE id = ANY(p_selected_truck_ids) AND order_id = v_order_id;

  IF EXISTS (
    SELECT 1 FROM public.order_trucks
    WHERE id = ANY(p_selected_truck_ids)
      AND (order_id <> v_order_id OR status IN ('cancelled', 'departed', 'finished', 'failed'))
  ) THEN
    RAISE EXCEPTION 'Ada unit yang dipilih tidak valid atau sudah tidak aktif.';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE source = 'internal'),
    COUNT(*) FILTER (WHERE source = 'vendor')
  INTO v_old_internal_count, v_old_vendor_count
  FROM public.order_trucks
  WHERE id = ANY(p_selected_truck_ids) AND order_id = v_order_id;

  UPDATE public.order_trucks
  SET status = 'cancelled', cancelled_at = NOW(),
      cancel_reason = (SELECT reason FROM public.order_change_requests WHERE id = p_request_id),
      updated_at = NOW()
  WHERE id = ANY(p_selected_truck_ids) AND order_id = v_order_id;

  FOR v_unit IN SELECT value FROM jsonb_array_elements(p_replacement_units)
  LOOP
    v_source := LOWER(COALESCE(v_unit->>'source', 'internal'));

    IF NULLIF(TRIM(v_unit->>'vehicle_type'), '') IS NULL THEN
      RAISE EXCEPTION 'Jenis kendaraan unit pengganti wajib diisi.';
    END IF;

    IF LOWER(TRIM(v_unit->>'vehicle_type')) <> LOWER(TRIM(v_requested_vehicle_type)) THEN
      RAISE EXCEPTION 'Jenis kendaraan unit pengganti harus %.', v_requested_vehicle_type;
    END IF;

    IF v_source NOT IN ('internal', 'vendor') THEN
      RAISE EXCEPTION 'Sumber unit harus internal atau vendor.';
    END IF;

    IF v_source = 'vendor' THEN
      IF NULLIF(TRIM(v_unit->>'vendor_name'), '') IS NULL THEN
        RAISE EXCEPTION 'Nama vendor wajib diisi untuk unit vendor.';
      END IF;
      v_new_vendor_count := v_new_vendor_count + 1;
    ELSE
      IF NULLIF(TRIM(v_unit->>'plate_number'), '') IS NULL THEN
        RAISE EXCEPTION 'Plat nomor unit pengganti wajib diisi.';
      END IF;

      IF NULLIF(TRIM(v_unit->>'driver_name'), '') IS NULL THEN
        RAISE EXCEPTION 'Nama driver unit pengganti wajib diisi.';
      END IF;

      IF NULLIF(TRIM(v_unit->>'driver_phone'), '') IS NULL THEN
        RAISE EXCEPTION 'No. HP driver unit pengganti wajib diisi.';
      END IF;

      v_new_internal_count := v_new_internal_count + 1;
    END IF;

    INSERT INTO public.order_trucks (
      order_id, source, vehicle_type, vendor_name, no_buntut,
      plate_number, driver_name, driver_phone, status
    )
    VALUES (
      v_order_id,
      v_source,
      TRIM(v_unit->>'vehicle_type'),
      CASE WHEN v_source = 'vendor'
        THEN NULLIF(TRIM(v_unit->>'vendor_name'), '') ELSE NULL END,
      NULLIF(TRIM(v_unit->>'no_buntut'), ''),
      CASE WHEN v_source = 'vendor' THEN NULL ELSE TRIM(v_unit->>'plate_number') END,
      CASE WHEN v_source = 'vendor' THEN NULL ELSE TRIM(v_unit->>'driver_name') END,
      CASE WHEN v_source = 'vendor' THEN NULL ELSE TRIM(v_unit->>'driver_phone') END,
      CASE WHEN v_source = 'vendor' THEN 'vm' ELSE 'waiting_hse' END
    );
  END LOOP;

  -- ==========================================
  -- SINKRONKAN ORDER_REQUIREMENTS: JENIS LAMA -> BARU
  -- ==========================================

  IF v_old_vehicle_type IS NOT NULL THEN
    SELECT quantity INTO v_old_requirement_quantity
    FROM public.order_requirements
    WHERE order_id = v_order_id AND lower(vehicle_type) = lower(v_old_vehicle_type)
    ORDER BY quantity DESC LIMIT 1 FOR UPDATE;

    IF v_old_requirement_quantity IS NOT NULL THEN
      IF v_old_requirement_quantity - v_requested_quantity <= 0 THEN
        DELETE FROM public.order_requirements
        WHERE order_id = v_order_id AND lower(vehicle_type) = lower(v_old_vehicle_type);
      ELSE
        UPDATE public.order_requirements
        SET quantity = v_old_requirement_quantity - v_requested_quantity
        WHERE order_id = v_order_id AND lower(vehicle_type) = lower(v_old_vehicle_type);
      END IF;
    END IF;

    PERFORM public.adjust_allocation_snapshot(v_order_id, v_old_vehicle_type, -v_old_internal_count, -v_old_vendor_count);
  END IF;

  SELECT quantity INTO v_new_requirement_quantity
  FROM public.order_requirements
  WHERE order_id = v_order_id AND lower(vehicle_type) = lower(v_requested_vehicle_type)
  ORDER BY quantity DESC LIMIT 1 FOR UPDATE;

  IF v_new_requirement_quantity IS NULL THEN
    INSERT INTO public.order_requirements (order_id, vehicle_type, quantity)
    VALUES (v_order_id, v_requested_vehicle_type, v_requested_quantity);
  ELSE
    UPDATE public.order_requirements
    SET quantity = v_new_requirement_quantity + v_requested_quantity
    WHERE order_id = v_order_id AND lower(vehicle_type) = lower(v_requested_vehicle_type);
  END IF;

  PERFORM public.adjust_allocation_snapshot(v_order_id, v_requested_vehicle_type, v_new_internal_count, v_new_vendor_count);

  UPDATE public.order_change_requests SET status = 'approved' WHERE id = p_request_id;
END;
$function$;

-- vm_fill_vendor_unit (versi lama)
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
