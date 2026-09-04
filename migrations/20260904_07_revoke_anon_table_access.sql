-- `drivers can read vehicles` was USING (true) for role `public`, which includes anon, so
-- the entire fleet (rego, make, model) was readable by anyone with the anon key.
drop policy if exists "drivers can read vehicles" on public.vehicles;
create policy "drivers can read vehicles" on public.vehicles
  for select to authenticated using (true);

-- The three admin policies on vehicles were duplicates of one another also targeting
-- `public`; collapse to one that targets authenticated.
drop policy if exists "admin read vehicles" on public.vehicles;
drop policy if exists "Admins read all vehicles" on public.vehicles;
drop policy if exists vehicles_admin_all on public.vehicles;
create policy vehicles_admin_all on public.vehicles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Neither app reads anything before sign-in (the marketing site is static; both login
-- screens only call supabase.auth), so remove anon's table grants outright rather than
-- leaving RLS as the only barrier between the anon key and this data.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', r.tablename);
  end loop;
end $$;

-- Pin search_path on the functions the earlier definer-only sweep missed, and close the
-- API on internal helpers no client calls. _break_total_seconds is deliberately kept
-- executable: shift_break_portal is a security_invoker view and calls it as the caller.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

revoke all on function public._end_break_if_needed(uuid) from authenticated;
revoke all on function public.check_vehicle_service_due(uuid) from authenticated;
revoke all on function public.checklist_approval_status(uuid) from authenticated;
