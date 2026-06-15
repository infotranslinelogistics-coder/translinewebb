-- Adds driver_status_events (read by the portal Driver profile + useDriverPresence
-- realtime + view_driver_current_status) AND a writer so it actually gets populated.
--
-- The app never writes this table directly; instead we derive status transitions
-- from shift_events (which the app DOES write) via an AFTER INSERT trigger.
-- Finally we (re)create view_driver_current_status to read from it — this is the
-- definition from migrations/20260520_recreate_view_driver_current_status.sql,
-- which could not be applied until this table existed.

-- 1) Table -------------------------------------------------------------------
create table if not exists public.driver_status_events (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  state text not null,                 -- 'active' | 'break' | 'idle' | 'offline'
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_status_events_driver_started
  on public.driver_status_events (driver_id, started_at desc);
create index if not exists idx_driver_status_events_shift
  on public.driver_status_events (shift_id);

alter table public.driver_status_events enable row level security;

create policy "admins read driver status events" on public.driver_status_events
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select on public.driver_status_events to authenticated, service_role;

-- 2) Writer: map shift_events -> driver_status_events ------------------------
create or replace function public.log_driver_status_from_shift_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_driver_id uuid;
begin
  v_state := case new.event_type
    when 'shift_start' then 'active'
    when 'break_start' then 'break'
    when 'break_end'   then 'active'
    when 'idle'        then 'idle'
    when 'shift_end'   then 'offline'
    else null
  end;

  if v_state is null then
    return new;                         -- ignore odometer/fuel/location/etc.
  end if;

  select s.driver_id into v_driver_id
  from public.shifts s
  where s.id = new.shift_id;

  if v_driver_id is null then
    return new;                         -- no resolvable driver; skip
  end if;

  insert into public.driver_status_events (driver_id, shift_id, state, started_at)
  values (v_driver_id, new.shift_id, v_state, coalesce(new.created_at, now()));

  return new;
end;
$$;

drop trigger if exists trg_log_driver_status on public.shift_events;
create trigger trg_log_driver_status
  after insert on public.shift_events
  for each row execute function public.log_driver_status_from_shift_event();

-- 3) Recreate the view now that the table exists ----------------------------
create or replace view public.view_driver_current_status as
with latest_status as (
  select distinct on (dse.driver_id)
    dse.driver_id, dse.state as status, dse.shift_id
  from public.driver_status_events dse
  order by dse.driver_id, dse.started_at desc nulls last
),
latest_shift as (
  select distinct on (s.driver_id)
    s.driver_id, s.id as shift_id, s.vehicle_id
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
