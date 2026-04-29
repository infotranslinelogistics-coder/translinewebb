-- Migration: Standardize assignment contract on vehicle_assignments + canonical RPCs
-- Date: 2026-04-17
-- Goals:
-- 1) Canonical unassign RPC: unassign_driver(p_driver uuid)
-- 2) Keep backward compatibility for unassign_vehicle(p_driver) via wrapper
-- 3) Ensure assignment logic is based on unassigned_at IS NULL
-- 4) Normalize vehicles_with_driver column names (vehicle_id, rego, driver_id, driver_name)
-- 5) If vehicle_assignments.active exists, keep it derived from unassigned_at (non-authoritative)

-- Canonical assign RPC (idempotent re-definition).
CREATE OR REPLACE FUNCTION public.assign_vehicle(p_driver uuid, p_vehicle uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Close any current assignment on the target vehicle.
  UPDATE public.vehicle_assignments
  SET unassigned_at = now()
  WHERE vehicle_id = p_vehicle
    AND unassigned_at IS NULL;

  -- Assign only when a driver is provided.
  IF p_driver IS NOT NULL THEN
    -- Close any current assignment for the driver.
    UPDATE public.vehicle_assignments
    SET unassigned_at = now()
    WHERE driver_id = p_driver
      AND unassigned_at IS NULL;

    -- Create new active assignment row.
    INSERT INTO public.vehicle_assignments (driver_id, vehicle_id, assigned_at)
    VALUES (p_driver, p_vehicle, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_vehicle(uuid, uuid) TO authenticated;

-- New canonical unassign RPC.
-- Idempotent: repeated calls update zero rows after first close.
CREATE OR REPLACE FUNCTION public.unassign_driver(p_driver uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.vehicle_assignments
  SET unassigned_at = now()
  WHERE driver_id = p_driver
    AND unassigned_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unassign_driver(uuid) TO authenticated;

-- Backward-compatible deprecated wrapper.
-- Keep existing callers of unassign_vehicle(p_driver) working while transitioning.
CREATE OR REPLACE FUNCTION public.unassign_vehicle(p_driver uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.unassign_driver(p_driver);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unassign_vehicle(uuid) TO authenticated;

COMMENT ON FUNCTION public.unassign_vehicle(uuid)
IS 'DEPRECATED: Use public.unassign_driver(p_driver). Wrapper retained for backward compatibility.';

-- If legacy "active" exists, keep it derived from unassigned_at and non-authoritative.
CREATE OR REPLACE FUNCTION public.vehicle_assignments_sync_active_from_unassigned_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.active := (NEW.unassigned_at IS NULL);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_assignments'
      AND column_name = 'active'
  ) THEN
    -- One-time backfill to keep active aligned with unassigned_at.
    UPDATE public.vehicle_assignments
    SET active = (unassigned_at IS NULL)
    WHERE active IS DISTINCT FROM (unassigned_at IS NULL);

    DROP TRIGGER IF EXISTS trg_vehicle_assignments_sync_active ON public.vehicle_assignments;

    CREATE TRIGGER trg_vehicle_assignments_sync_active
    BEFORE INSERT OR UPDATE ON public.vehicle_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.vehicle_assignments_sync_active_from_unassigned_at();
  END IF;
END;
$$;

-- Canonical vehicle view with unambiguous naming.
CREATE OR REPLACE VIEW public.vehicles_with_driver AS
SELECT
  v.id AS vehicle_id,
  v.rego,
  d.driver_id,
  d.full_name AS driver_name
FROM public.vehicles v
LEFT JOIN LATERAL (
  SELECT va.driver_id
  FROM public.vehicle_assignments va
  WHERE va.vehicle_id = v.id
    AND va.unassigned_at IS NULL
  ORDER BY va.assigned_at DESC
  LIMIT 1
) va ON true
LEFT JOIN public.drivers_with_current_vehicle d
  ON d.driver_id = va.driver_id;

GRANT SELECT ON public.vehicles_with_driver TO authenticated;
