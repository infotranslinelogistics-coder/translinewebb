// Vehicles data access layer
import { supabase } from '../supabase';

export interface Vehicle {
  id: string;
  rego: string;
  // Backward-compatible alias while portal code is standardized on `rego`.
  plate_number?: string;
  make: string | null;
  model: string | null;
  driver_name?: string | null;
  driver_id?: string | null;
  status: 'active' | 'maintenance' | 'inactive';
  last_inspection_date?: string | null;
  created_at: string;
  updated_at?: string | null;
}

type VehicleAssignmentRow = {
  vehicle_id: string;
  driver_id: string | null;
  driver_name: string | null;
};

async function listVehiclesWithDriver(): Promise<Vehicle[]> {
  const [vehiclesResponse, assignmentsResponse] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, rego, make, model, status, created_at')
      .order('rego'),
    supabase.from('vehicles_with_driver').select('vehicle_id, driver_id, driver_name'),
  ]);

  if (vehiclesResponse.error) throw vehiclesResponse.error;
  if (assignmentsResponse.error) throw assignmentsResponse.error;

  const assignmentByVehicleId = new Map(
    ((assignmentsResponse.data ?? []) as VehicleAssignmentRow[]).map((row) => [row.vehicle_id, row])
  );

  return ((vehiclesResponse.data ?? []) as Vehicle[]).map((vehicle) => {
    const assignment = assignmentByVehicleId.get(vehicle.id);
    return {
      ...vehicle,
      last_inspection_date: null,
      updated_at: null,
      plate_number: vehicle.rego,
      driver_id: assignment?.driver_id ?? null,
      driver_name: assignment?.driver_name ?? null,
    };
  });
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    return await listVehiclesWithDriver();
  } catch (error) {
    console.error('Vehicle fetch error:', error);
    return [];
  }
}

export async function listVehicles(): Promise<Vehicle[]> {
  return listVehiclesWithDriver();
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function createVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert([vehicle])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atomically unassign any vehicle the driver currently has and assign the driver to the target vehicle.
export async function assignDriverToVehicle(driverId: string | null, vehicleId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_vehicle', { p_driver: driverId, p_vehicle: vehicleId });
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function countActiveVehicles(): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) throw error;
  return count || 0;
}

export async function countTotalVehicles(): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

export async function countVehiclesInMaintenance(): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'maintenance');

  if (error) throw error;
  return count || 0;
}
