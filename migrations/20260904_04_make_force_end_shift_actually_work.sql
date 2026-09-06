-- force_end_shift sets status='completed', but trg_validate_shift_completion requires
-- shift_end + odometer_end + a post-shift_end location event first. A shift needing a
-- force-end is precisely one missing those, so the RPC failed 100% of the time.
--
-- The RPC now records a genuine shift_end event, then sets a transaction-local flag that
-- waives only the two checks a force-end cannot satisfy. The flag is transaction-scoped
-- and set inside the SECURITY DEFINER function, so it cannot be forged over the REST API.
-- The normal driver end-of-shift path keeps full validation.

create or replace function public.validate_shift_completion_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_forced boolean := coalesce(current_setting('app.force_end_shift', true) = 'on', false);
begin
  if new.status = 'completed' then
    if not exists (
      select 1 from public.shift_events
      where shift_id = new.id and event_type = 'shift_end'
    ) then
      raise exception 'Shift % cannot be completed without a shift_end event', new.id;
    end if;

    if not v_forced then
      if not exists (
        select 1 from public.shift_events
        where shift_id = new.id and event_type = 'odometer_end'
      ) then
        raise exception 'Shift % cannot be completed without an odometer_end event', new.id;
      end if;

      if not exists (
        select 1
        from public.shift_events se_loc
        where se_loc.shift_id = new.id
          and se_loc.event_type = 'location'
          and se_loc.latitude is not null
          and se_loc.longitude is not null
          and exists (
            select 1 from public.shift_events se_end
            where se_end.shift_id = new.id
              and se_end.event_type = 'shift_end'
              and se_end.created_at <= se_loc.created_at
          )
      ) then
        raise exception 'Shift % cannot be completed without an end location (lat/lng)', new.id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.force_end_shift(p_shift_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shift_id uuid;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Force ended by admin');
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.shifts where id = p_shift_id) then
    raise exception 'Shift not found: %', p_shift_id;
  end if;

  insert into public.shift_events (shift_id, event_type, metadata)
  values (p_shift_id, 'force_end_shift',
          jsonb_build_object('reason', v_reason, 'source', 'portal_admin'));

  if not exists (
    select 1 from public.shift_events
    where shift_id = p_shift_id and event_type = 'shift_end'
  ) then
    insert into public.shift_events (shift_id, event_type, metadata)
    values (p_shift_id, 'shift_end',
            jsonb_build_object('reason', v_reason, 'source', 'portal_admin', 'forced', true));
  end if;

  perform set_config('app.force_end_shift', 'on', true);

  update public.shifts
     set status = 'completed', ended_at = coalesce(ended_at, now())
   where id = p_shift_id
  returning id into v_shift_id;

  perform set_config('app.force_end_shift', 'off', true);
end;
$$;

revoke all on function public.force_end_shift(uuid, text) from public, anon;
grant execute on function public.force_end_shift(uuid, text) to authenticated;
