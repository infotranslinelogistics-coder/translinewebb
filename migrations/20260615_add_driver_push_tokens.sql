-- Adds driver_push_tokens, used by the app's pushNotifications.savePushToken()
-- which upserts { driver_id, push_token, platform, updated_at } on (driver_id, platform).

create table if not exists public.driver_push_tokens (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, platform)
);

alter table public.driver_push_tokens enable row level security;

-- A driver may manage only their own token rows (drivers.user_id = auth.uid()).
drop policy if exists "drivers manage own push tokens" on public.driver_push_tokens;
create policy "drivers manage own push tokens" on public.driver_push_tokens
  for all to authenticated
  using (driver_id in (select id from public.drivers where user_id = auth.uid()))
  with check (driver_id in (select id from public.drivers where user_id = auth.uid()));

grant select, insert, update, delete on public.driver_push_tokens to authenticated;
