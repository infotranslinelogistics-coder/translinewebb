-- `profiles_admin_access` tested `auth.jwt() ->> 'role' = 'admin'`, but that claim carries
-- the Postgres role ('authenticated'), never the application role in public.profiles. The
-- policy matched nobody, so admins could only read their own profile row. It was invisible
-- while the reporting views were SECURITY DEFINER and bypassed RLS.
--
-- is_admin() reads public.profiles, so a profiles policy calling it would recurse. Making
-- it SECURITY DEFINER lets it bypass RLS for that lookup and breaks the cycle.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists profiles_admin_access on public.profiles;
create policy profiles_admin_access on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
