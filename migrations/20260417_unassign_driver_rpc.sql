-- Migration: add canonical RPC to unassign all active vehicles for a driver
CREATE OR REPLACE FUNCTION public.unassign_driver(p_driver uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.vehicle_assignments
    SET unassigned_at = now()
    WHERE driver_id = p_driver
      AND unassigned_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.unassign_driver(uuid) TO authenticated;
