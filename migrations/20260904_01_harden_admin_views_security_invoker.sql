-- Applied to project fjllbnhcyugxltiresjp on 2026-09-04.
--
-- All 14 reporting views were SECURITY DEFINER (bypassing base-table RLS); three were
-- granted SELECT to `anon`, so anyone holding the publicly committed anon key could read
-- every driver's live GPS and the admin audit log. All were also granted
-- INSERT/UPDATE/DELETE to `authenticated`, which on the four auto-updatable views
-- (activity_logs, checklist_approval_requests, shift_break_portal, vehicle_service_alerts)
-- let any signed-in driver write straight through to admin_audit_logs and
-- checklist_approvals -- e.g. self-approving a failed safety checklist.
--
-- Views now run as the invoker, so existing base-table RLS applies: admins keep full
-- access via their *_admin_all policies, drivers see only their own rows. No application
-- code writes through a view, so write grants are dropped.

do $$
declare v text;
begin
  foreach v in array array[
    'activity_logs','checklist_approval_requests','driver_logs_admin','drivers_full',
    'drivers_with_current_vehicle','fuel_logs_admin','odometer_readings_admin',
    'shift_break_portal','shifts_full','vehicle_latest_odometer','vehicle_service_alerts',
    'vehicles_with_driver','view_driver_current_status','view_driver_latest_location'
  ]
  loop
    execute format('alter view public.%I set (security_invoker = true)', v);
    execute format('revoke all on public.%I from anon', v);
    execute format('revoke all on public.%I from authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
