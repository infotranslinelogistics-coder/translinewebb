-- assign_vehicle / unassign_driver / force_end_shift / generate_maintenance_alerts were
-- SECURITY DEFINER with no authorization check. assign_vehicle and unassign_driver were
-- additionally executable by `anon`, so anyone with the publicly committed anon key could
-- reassign the fleet. Guards are enforced in-body (defense in depth) and the API surface
-- is closed to anon. Default grants hand EXECUTE to PUBLIC, which anon inherits, so
-- revoking from anon alone is not sufficient.

create or replace function public.assign_vehicle(p_driver uuid, p_vehicle uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.vehicle_assignments
    where driver_id = p_driver and vehicle_id = p_vehicle and unassigned_at is null
  ) then
    return;
  end if;

  update public.vehicle_assignments
    set unassigned_at = now(), active = false
  where vehicle_id = p_vehicle and unassigned_at is null;

  if p_driver is not null then
    update public.vehicle_assignments
      set unassigned_at = now(), active = false
    where driver_id = p_driver and unassigned_at is null;

    insert into public.vehicle_assignments (driver_id, vehicle_id, assigned_at, active)
    values (p_driver, p_vehicle, now(), true);
  end if;
end;
$$;

create or replace function public.unassign_driver(p_driver uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.vehicle_assignments
    set unassigned_at = now(), active = false
  where driver_id = p_driver and unassigned_at is null;
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text sig, p.prosecdef, t.typname rettype
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    if r.rettype <> 'trigger' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    if r.prosecdef then
      execute format('alter function %s set search_path = public, pg_temp', r.sig);
    end if;
  end loop;
end $$;

-- Unused legacy duplicates: no caller in either repo, and assign_vehicle_to_driver
-- references drivers.vehicle_id, a column that does not exist. Left in place but
-- unreachable from the API. Same for the stale start_shift / request_checklist_approval
-- overloads -- only the signatures the apps actually call stay callable.
revoke all on function public.assign_driver_to_vehicle(uuid, uuid) from authenticated;
revoke all on function public.assign_vehicle_to_driver(uuid, uuid) from authenticated;
revoke all on function public.unassign_vehicle(uuid) from authenticated;
revoke all on function public.generate_maintenance_alerts() from authenticated;
revoke all on function public.review_checklist_approval(uuid, checklist_approval_status, text) from authenticated;
revoke all on function public.handle_driver_login(uuid, jsonb) from authenticated;
revoke all on function public.start_shift(uuid, jsonb, numeric, numeric) from authenticated;
revoke all on function public.start_shift(uuid, uuid, double precision, double precision, jsonb, jsonb) from authenticated;
revoke all on function public.start_shift(uuid, jsonb, integer, text, numeric, numeric, jsonb) from authenticated;
revoke all on function public.request_checklist_approval(uuid, jsonb, jsonb) from authenticated;
revoke all on function public.request_checklist_approval(uuid, jsonb) from authenticated;
