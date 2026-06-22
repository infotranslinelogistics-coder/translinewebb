-- Supabase schema verification for TransLine (admin portal + driver app)
-- Run this in the Supabase SQL editor (or via a service-role/admin connection).
-- It is READ-ONLY: it only reads system catalogs. It does NOT modify data and
-- does NOT invoke any RPC, so it is safe to run against production.
--
-- Output: one row per required object, columns (kind, name, status, detail).
-- Rows with status MISSING or WARN sort to the top.

with
-- Tables and views the code queries via supabase.from(...)
rel(name) as (
  values
    ('activity_logs'), ('admin_audit_logs'), ('checklist_approval_requests'),
    ('checklist_approvals'), ('driver_logs_admin'), ('driver_presence'),
    ('driver_push_tokens'), ('driver_status_events'), ('drivers'), ('drivers_full'),
    ('drivers_with_current_vehicle'), ('maintenance_items'), ('odometer_readings'),
    ('odometer_readings_admin'), ('profiles'), ('shift_events'), ('shifts'),
    ('shifts_full'), ('vehicle_assignments'), ('vehicle_latest_odometer'),
    ('vehicle_service_alerts'), ('vehicles'), ('vehicles_with_driver'),
    ('view_driver_current_status'), ('view_driver_latest_location')
),
-- Functions the code calls via supabase.rpc(...)
fn(name) as (
  values
    ('approve_checklist_request'), ('assign_vehicle'), ('delete_driver_log_admin'),
    ('delete_fuel_log_admin'), ('delete_shift_admin'), ('end_break'), ('end_shift'),
    ('force_end_shift'), ('log_idle_event'), ('reject_checklist_request'),
    ('request_checklist_approval'), ('start_break'), ('start_shift'), ('unassign_driver')
),
-- Storage buckets the code uploads to / reads signed URLs from
bk(name) as (
  values ('odometer_photos'), ('fuel_receipts'), ('driver_log_photos')
),
rel_check as (
  select 'table/view' as kind, r.name,
    case when c.relname is not null then 'present' else 'MISSING' end as status,
    coalesce(case c.relkind
      when 'r' then 'table' when 'v' then 'view' when 'm' then 'matview'
      when 'p' then 'partitioned table' else c.relkind::text end, '-') as detail
  from rel r
  left join pg_class c
    on c.relname = r.name and c.relnamespace = 'public'::regnamespace
),
fn_check as (
  select 'function' as kind, f.name,
    case when count(p.oid) > 0 then 'present' else 'MISSING' end as status,
    coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | '), '-') as detail
  from fn f
  left join pg_proc p
    on p.proname = f.name and p.pronamespace = 'public'::regnamespace
  group by f.name
),
bk_check as (
  select 'bucket' as kind, b.name,
    case when s.id is not null then 'present' else 'MISSING' end as status,
    coalesce('public=' || s.public::text, '-') as detail
  from bk b
  left join storage.buckets s on s.name = b.name
),
-- Flag base tables that have RLS enabled but zero policies: the classic
-- "page loads but shows nothing / writes silently fail" cause.
rls_check as (
  select 'rls-warn' as kind, c.relname as name, 'WARN' as status,
    'RLS enabled but 0 policies' as detail
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and c.relname in (select name from rel)
)
select * from rel_check
union all select * from fn_check
union all select * from bk_check
union all select * from rls_check
order by status, kind, name;
