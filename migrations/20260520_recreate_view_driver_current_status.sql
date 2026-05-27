-- Recreate view_driver_current_status with the column contract expected by the portal.
-- Missing telemetry columns are exposed as NULL placeholders for compatibility.

create or replace view public.view_driver_current_status as
with latest_status as (
  select distinct on (dse.driver_id)
    dse.driver_id,
    dse.state as status,
    dse.shift_id
  from public.driver_status_events dse
  order by dse.driver_id, dse.started_at desc nulls last
),
latest_shift as (
  select distinct on (s.driver_id)
    s.driver_id,
    s.id as shift_id,
    s.vehicle_id
  from public.shifts s
  where s.ended_at is null or s.status = 'active'
  order by s.driver_id, s.started_at desc nulls last
)
select
  d.id as driver_id,
  ls.status,
  coalesce(ls.shift_id, lsh.shift_id) as shift_id,
  vll.created_at as last_location_at,
  vll.latitude as lat,
  vll.longitude as lng,
  null::numeric as speed_kmh,
  null::numeric as heading,
  lsh.vehicle_id,
  dp.last_seen_at
from public.drivers d
left join latest_status ls on ls.driver_id = d.id
left join latest_shift lsh on lsh.driver_id = d.id
left join public.view_driver_latest_location vll on vll.driver_id = d.id
left join public.driver_presence dp on dp.driver_id = d.id;

grant select on public.view_driver_current_status to anon, authenticated, service_role;
