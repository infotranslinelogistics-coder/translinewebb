-- `active` was true on all 12 rows, including the 10 closed ones (unassigned_at set).
-- All application code correctly filters on `unassigned_at is null`, so nothing was broken
-- today, but the column was a trap for the next query written against it.

update public.vehicle_assignments
   set active = (unassigned_at is null)
 where active is distinct from (unassigned_at is null);

alter table public.vehicle_assignments
  add constraint vehicle_assignments_active_matches_unassigned_at
  check (active = (unassigned_at is null)) not valid;

alter table public.vehicle_assignments
  validate constraint vehicle_assignments_active_matches_unassigned_at;
