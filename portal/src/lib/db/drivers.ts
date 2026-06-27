// Drivers data access layer
import { supabase } from '../supabase';

export interface Driver {
  driver_id: string;
  full_name?: string | null;
  profile_email?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: 'active' | 'inactive' | string | null;
  auth_user_id?: string | null;
  current_vehicle_id?: string | null;
  current_vehicle_rego?: string | null;
  online_status?: 'online' | 'offline' | string | null;
  device_id?: string | null;
  last_seen?: string | null;
}

// export async function listDrivers(): Promise<Driver[]> {
//   const { data, error } = await supabase
//     .from('drivers_with_current_vehicle')
//     .select('driver_id, full_name, profile_email, email, phone, status, auth_user_id, current_vehicle_id, current_vehicle_rego')
//     .order('full_name');

//   if (error) throw error;
//   return (data as Driver[]) || [];
// }

export async function listDrivers(): Promise<Driver[]> {
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select(`
      id,
      full_name,
      status,
      user_id,
      driver_presence!left (
        device_id,
        shift_id,
        status,
        last_seen
      )
    `)
    .order('full_name', { ascending: true });

  if (driversError) throw driversError;

  const userIds = (drivers || [])
    .map(d => d.user_id)
    .filter(Boolean);

  const [profilesResponse, vehicleAssignmentsResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, phone, email')
      .in('id', userIds),
    supabase
      .from('vehicles_with_driver')
      .select('vehicle_id, rego, driver_id'),
  ]);

  const { data: profiles, error: profilesError } = profilesResponse;
  const { data: vehicleAssignments, error: vehicleAssignmentsError } = vehicleAssignmentsResponse;

  if (profilesError) throw profilesError;
  if (vehicleAssignmentsError) throw vehicleAssignmentsError;

  const profileMap = new Map(
    (profiles || []).map(p => [p.id, p])
  );

  const vehicleByDriverId = new Map(
    ((vehicleAssignments || []) as Array<{ vehicle_id: string | null; rego: string | null; driver_id: string | null }>)
      .filter((assignment) => Boolean(assignment.driver_id))
      .map((assignment) => [assignment.driver_id as string, assignment])
  );

  return (drivers || []).map((d: any) => {
    const assignment = vehicleByDriverId.get(d.id);

    const presence = Array.isArray(d.driver_presence)
      ? d.driver_presence[0]
      : d.driver_presence;

    const profile = profileMap.get(d.user_id);

    return {
      driver_id: d.id,
      full_name: d.full_name,
      status: d.status,
      auth_user_id: d.user_id,
      phone: profile?.phone || null,
      email: profile?.email || null,

      current_vehicle_id: assignment?.vehicle_id || null,
      current_vehicle_rego: assignment?.rego || null,

      online_status: presence?.status || 'offline',
      device_id: presence?.device_id || null,
      active_shift_id: presence?.shift_id || null,
      last_seen: presence?.last_seen || null
    };
  });
}

// export async function getDriver(id: string): Promise<Driver | null> {
//   const { data, error } = await supabase
//     .from('drivers_with_current_vehicle')
//     .select('driver_id, full_name, email, phone, status, auth_user_id, current_vehicle_id, current_vehicle_rego')
//     .eq('driver_id', id)
//     .maybeSingle();

//   if (error) throw error;
//   return (data as Driver | null) ?? null;
// }

export async function getDriver(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      user_id,
      full_name,
      status,
      profiles!drivers_user_id_fkey ( phone, email ),
      vehicle_assignments!vehicle_assignments_driver_id_fkey (
        vehicle_id,
        vehicles ( rego )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const activeAssignment = data.vehicle_assignments
    ?.find((a: Record<string, unknown>) => a.active === true);

  return {
    driver_id: data.id,
    auth_user_id: data.user_id ?? null,
    full_name: data.full_name ?? null,
    status: data.status ?? null,
    phone: (data.profiles as { phone?: string; email?: string } | null)?.phone ?? null,
    email: (data.profiles as { phone?: string; email?: string } | null)?.email ?? null,
    current_vehicle_id: activeAssignment?.vehicle_id ?? null,
    current_vehicle_rego: (activeAssignment?.vehicles as { rego?: string } | null)?.rego ?? null,
  };
}


export async function createDriver(driver: Record<string, unknown>): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .insert([driver])
    .select('*')
    .single();

  if (error) throw error;
  return data as Driver;
}

export async function updateDriver(id: string, updates: Record<string, unknown>): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Driver;
}

export async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function countActiveDrivers(): Promise<number> {
  const { count, error } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) throw error;
  return count || 0;
}

export async function countTotalDrivers(): Promise<number> {
  const { count, error } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}
