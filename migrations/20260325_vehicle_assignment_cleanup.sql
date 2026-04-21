-- Migration: standardize vehicle assignment on vehicle_assignments and tracked views

-- Remove the legacy direct-assignment function before dropping the obsolete columns it writes.
DROP FUNCTION IF EXISTS public.assign_driver_to_vehicle(uuid, uuid);

-- Remove legacy direct-assignment artifacts on vehicles.
DROP INDEX IF EXISTS public.one_active_vehicle_per_driver;

ALTER TABLE IF EXISTS public.vehicles
  DROP COLUMN IF EXISTS assigned_driver_id,
  DROP COLUMN IF EXISTS assigned_at;

-- Canonical assignment RPC. Passing a driver assigns that driver to the vehicle.
-- Passing NULL unassigns the target vehicle from its current driver.
CREATE OR REPLACE FUNCTION public.assign_vehicle(p_driver uuid, p_vehicle uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.vehicle_assignments
    SET unassigned_at = now()
    WHERE vehicle_id = p_vehicle AND unassigned_at IS NULL;

  IF p_driver IS NOT NULL THEN
    UPDATE public.vehicle_assignments
      SET unassigned_at = now()
      WHERE driver_id = p_driver AND unassigned_at IS NULL;

    INSERT INTO public.vehicle_assignments (driver_id, vehicle_id, assigned_at)
      VALUES (p_driver, p_vehicle, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.assign_vehicle(uuid, uuid) TO authenticated;

-- Track the runtime dependency for driver dropdowns and the drivers admin page.
DO $$
DECLARE
  driver_name_expr text := 'NULL::text';
  profile_email_expr text := 'NULL::text';
  driver_email_expr text := 'NULL::text';
  auth_user_id_expr text := 'NULL::uuid';
  status_expr text := quote_literal('active') || '::text';
  profile_join_sql text := 'LEFT JOIN (SELECT NULL::uuid AS id, NULL::text AS email) p ON false';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'full_name'
  ) THEN
    driver_name_expr := 'd.full_name';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'name'
  ) THEN
    driver_name_expr := 'd.name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'email'
  ) THEN
    driver_email_expr := 'd.email';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'status'
  ) THEN
    status_expr := 'd.status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'auth_user_id'
  ) THEN
    auth_user_id_expr := 'd.auth_user_id';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
    ) THEN
      profile_email_expr := 'p.email';
      profile_join_sql := 'LEFT JOIN public.profiles p ON p.id = d.auth_user_id';
    END IF;
  END IF;

  EXECUTE format(
    $sql$
    CREATE OR REPLACE VIEW public.drivers_with_current_vehicle AS
    SELECT
      d.id AS driver_id,
      %1$s AS full_name,
      %2$s AS profile_email,
      COALESCE(%2$s, %3$s) AS email,
      %4$s AS auth_user_id,
      %5$s AS status,
      va.vehicle_id AS current_vehicle_id,
      v.rego AS current_vehicle_rego
    FROM public.drivers d
    %6$s
    LEFT JOIN LATERAL (
      SELECT vehicle_id
      FROM public.vehicle_assignments
      WHERE driver_id = d.id AND unassigned_at IS NULL
      ORDER BY assigned_at DESC
      LIMIT 1
    ) va ON true
    LEFT JOIN public.vehicles v ON v.id = va.vehicle_id
    $sql$,
    driver_name_expr,
    profile_email_expr,
    driver_email_expr,
    auth_user_id_expr,
    status_expr,
    profile_join_sql
  );
END;
$$;

GRANT SELECT ON public.drivers_with_current_vehicle TO authenticated;

-- Canonical vehicle list with the current assignment joined from vehicle_assignments.
CREATE OR REPLACE VIEW public.vehicles_with_driver AS
SELECT
  v.id,
  v.rego,
  v.make,
  v.model,
  v.status,
  v.is_active,
  v.created_at,
  v.updated_at,
  d.full_name AS driver_name,
  d.driver_id
FROM public.vehicles v
LEFT JOIN public.vehicle_assignments va
  ON va.vehicle_id = v.id AND va.unassigned_at IS NULL
LEFT JOIN public.drivers_with_current_vehicle d
  ON d.driver_id = va.driver_id;

GRANT SELECT ON public.vehicles_with_driver TO authenticated;