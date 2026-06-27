import { supabase } from '../supabase';

export interface Vehicle {
  id: string;
  rego: string;
  make: string | null;
  model: string | null;
  status: 'active' | 'maintenance' | 'inactive' | string;
  driver_id: string | null;
  driver_name: string | null;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const [vehiclesResponse, assignmentsResponse] = await Promise.all([
    supabase.from('vehicles').select('id, rego, make, model, status').order('rego'),
    supabase.from('vehicles_with_driver').select('vehicle_id, driver_id, driver_name'),
  ]);

  if (vehiclesResponse.error) throw vehiclesResponse.error;
  if (assignmentsResponse.error) throw assignmentsResponse.error;

  const assignmentByVehicleId = new Map(
    (assignmentsResponse.data || []).map((row: any) => [row.vehicle_id, row])
  );

  return (vehiclesResponse.data || []).map((vehicle: any) => {
    const assignment = assignmentByVehicleId.get(vehicle.id);
    return {
      ...vehicle,
      driver_id: assignment?.driver_id ?? null,
      driver_name: assignment?.driver_name ?? null,
    };
  });
}
