-- Lets an admin optionally expose their approval/reject note to the driver.
--
-- Schema note: checklist_approvals is the BASE TABLE (admin portal reads it
-- directly). checklist_approval_requests is a VIEW over it, which the driver app
-- reads. So the column goes on the table, the view is recreated to expose it,
-- and the setter updates the table.

-- 1) Column on the base table.
alter table public.checklist_approvals
  add column if not exists note_visible_to_driver boolean not null default false;

-- 2) Expose the flag through the driver-facing view (recreated exactly as it was,
--    with note_visible_to_driver appended).
create or replace view public.checklist_approval_requests as
 select id,
    driver_id,
    vehicle_id,
    shift_id,
    checklist,
    failed_items,
    status,
    requested_at as created_at,
    requested_at,
    reviewed_at,
    reviewed_by,
    admin_note,
    note_visible_to_driver
   from checklist_approvals;

-- 3) Admin-only setter so the portal can toggle visibility without recreating
--    approve_checklist_request / reject_checklist_request (whose bodies live only
--    in the database). Admin check mirrors delete_driver_log_admin: profiles.role
--    = 'admin'. If the existing approval RPCs use a different admin convention
--    (an is_admin() helper, etc.), align this check with them.
create or replace function public.set_checklist_note_visibility(
  p_request_id uuid,
  p_visible boolean
)
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

  update public.checklist_approvals
  set note_visible_to_driver = coalesce(p_visible, false)
  where id = p_request_id;
end;
$$;

grant execute on function public.set_checklist_note_visibility(uuid, boolean) to authenticated;
