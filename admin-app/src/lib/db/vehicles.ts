import { supabase } from '../supabase';

export interface Vehicle {
  id: string;
  rego: string;
  make: string | null;
  model: string | null;
  status: 'active' | 'maintenance' | 'inactive' | string;
  created_at?: string | null;
  driver_id: string | null;
  driver_name: string | null;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const [vehiclesResponse, assignmentsResponse] = await Promise.all([
    supabase.from('vehicles').select('id, rego, make, model, status, created_at').order('rego'),
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

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const [vehicleResponse, assignmentResponse] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, rego, make, model, status, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('vehicles_with_driver')
      .select('driver_id, driver_name')
      .eq('vehicle_id', id)
      .maybeSingle(),
  ]);

  if (vehicleResponse.error) throw vehicleResponse.error;
  if (!vehicleResponse.data) return null;

  return {
    ...(vehicleResponse.data as any),
    driver_id: (assignmentResponse.data as any)?.driver_id ?? null,
    driver_name: (assignmentResponse.data as any)?.driver_name ?? null,
  };
}

export async function createVehicle(input: {
  rego: string;
  make?: string | null;
  model?: string | null;
  status?: string;
}): Promise<void> {
  const { error } = await supabase.from('vehicles').insert([
    {
      rego: input.rego,
      make: input.make ?? null,
      model: input.model ?? null,
      status: input.status ?? 'active',
    },
  ]);
  if (error) throw error;
}

export async function updateVehicle(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('vehicles').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

// assign_vehicle handles BOTH assignment (driverId) and unassignment (null).
export async function assignDriverToVehicle(vehicleId: string, driverId: string | null): Promise<void> {
  const { error } = await supabase.rpc('assign_vehicle', {
    p_driver: driverId,
    p_vehicle: vehicleId,
  });
  if (error) throw error;
}

// Clears a driver's current vehicle (used from the driver side).
export async function unassignDriver(driverId: string): Promise<void> {
  const { error } = await supabase.rpc('unassign_driver', { p_driver: driverId });
  if (error) throw error;
}

export async function listActiveVehicles(): Promise<Array<{ id: string; rego: string; status: string }>> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, rego, status')
    .eq('status', 'active')
    .order('rego');
  if (error) throw error;
  return (data as Array<{ id: string; rego: string; status: string }>) ?? [];
}

export async function countTotalVehicles(): Promise<number> {
  const { count, error } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function countActiveVehicles(): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export async function countVehiclesInMaintenance(): Promise<number> {
  const { count, error } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'maintenance');
  if (error) throw error;
  return count ?? 0;
}

// Set of vehicle_ids currently on an active shift (for the On-Shift badge/stat).
export async function getVehicleIdsOnActiveShift(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('shifts')
    .select('vehicle_id')
    .or('status.eq.active,ended_at.is.null')
    .not('vehicle_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.vehicle_id as string));
}
