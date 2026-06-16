-- Lets an admin optionally expose their approval/reject note to the driver.
-- The driver app reads checklist_approval_requests directly and only shows the
-- admin_note when note_visible_to_driver is true.

alter table public.checklist_approval_requests
  add column if not exists note_visible_to_driver boolean not null default false;

-- Dedicated setter so the portal can toggle visibility without us having to
-- recreate approve_checklist_request / reject_checklist_request (whose bodies
-- live only in the database). Admin check mirrors delete_driver_log_admin:
-- profiles.role = 'admin'. If the existing approval RPCs use a different admin
-- convention (an is_admin() helper, etc.), align this check with them.
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

  update public.checklist_approval_requests
  set note_visible_to_driver = coalesce(p_visible, false)
  where id = p_request_id;
end;
$$;

grant execute on function public.set_checklist_note_visibility(uuid, boolean) to authenticated;
