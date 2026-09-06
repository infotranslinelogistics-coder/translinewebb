-- The physical public.odometer_readings table has 0 rows and no writer anywhere in either
-- repo -- the driver app records odometer captures as shift_events. Three admin surfaces
-- read that empty table directly, so their odometer tabs were always blank:
--   portal/src/pages/DriverProfilePage.tsx
--   portal/src/pages/VehicleProfilePage.tsx
--   admin-app/src/lib/db/odometer.ts
--
-- odometer_readings_admin is one row per *shift* (start+end paired), which does not fit
-- those call sites. This view exposes the same event data as one row per *reading*,
-- matching the column set that code already selects.

create or replace view public.odometer_readings_feed
with (security_invoker = true) as
select
  se.id,
  s.driver_id,
  coalesce(nullif(se.metadata ->> 'vehicle_id', '')::uuid, s.vehicle_id) as vehicle_id,
  se.shift_id,
  (se.metadata ->> 'odometer_value')::numeric as reading,
  se.metadata ->> 'photo_path'                as photo_path,
  case when se.event_type = 'odometer_start' then 'start' else 'end' end as reading_type,
  coalesce((se.metadata ->> 'captured_at')::timestamptz, se.created_at) as captured_at,
  se.created_at,
  se.latitude  as lat,
  se.longitude as lng
from public.shift_events se
join public.shifts s on s.id = se.shift_id
where se.event_type in ('odometer_start', 'odometer_end');

revoke all on public.odometer_readings_feed from public, anon;
grant select on public.odometer_readings_feed to authenticated;
