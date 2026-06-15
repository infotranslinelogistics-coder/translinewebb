-- Adds delete_driver_log_admin(p_event_id uuid), called by the portal Logs page.
-- Mirrors the existing delete_fuel_log_admin(p_event_id uuid): an admin deletes a
-- single shift_events row, restricted to event_type = 'driver_log'.
-- NOTE: admin check assumes profiles.role = 'admin' (same convention as the admin
-- API). If delete_fuel_log_admin uses a different check (e.g. an is_admin() helper
-- or writes admin_audit_logs), match that here for consistency.

create or replace function public.delete_driver_log_admin(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  delete from public.shift_events
  where id = p_event_id and event_type = 'driver_log';
end;
$$;

grant execute on function public.delete_driver_log_admin(uuid) to authenticated;
