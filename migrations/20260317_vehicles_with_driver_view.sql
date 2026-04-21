-- Migration: Add vehicles_with_driver view and assign_vehicle RPC

-- View: vehicles joined with current driver assignment from vehicle_assignments
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
LEFT JOIN public.drivers_full d
  ON d.driver_id = va.driver_id;

-- Allow authenticated users to SELECT from the view
GRANT SELECT ON public.vehicles_with_driver TO authenticated;

-- RPC: Atomically assign or unassign a driver to a vehicle via vehicle_assignments table
CREATE OR REPLACE FUNCTION public.assign_vehicle(p_driver uuid, p_vehicle uuid)
RETURNS void AS $$
BEGIN
  -- Unassign the target vehicle from whoever currently holds it
  UPDATE public.vehicle_assignments
    SET unassigned_at = now()
    WHERE vehicle_id = p_vehicle AND unassigned_at IS NULL;

  IF p_driver IS NOT NULL THEN
    -- Unassign the driver from any other vehicle they currently hold
    UPDATE public.vehicle_assignments
      SET unassigned_at = now()
      WHERE driver_id = p_driver AND unassigned_at IS NULL;

    -- Insert the new assignment record
    INSERT INTO public.vehicle_assignments (driver_id, vehicle_id, assigned_at)
      VALUES (p_driver, p_vehicle, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
