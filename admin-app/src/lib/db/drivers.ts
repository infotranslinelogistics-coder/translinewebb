import { supabase } from '../supabase';
import { listDriverEmails } from '../api/admin';

export interface Driver {
  driver_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  auth_user_id: string | null;
  online_status: 'online' | 'offline' | string | null;
  current_vehicle_id: string | null;
  current_vehicle_rego: string | null;
  device_id: string | null;
  last_seen: string | null;
}

export async function listDrivers(): Promise<Driver[]> {
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select(
      `
      id,
      full_name,
      status,
      user_id,
      driver_presence!left ( device_id, shift_id, status, last_seen )
    `
    )
    .order('full_name', { ascending: true });

  if (driversError) throw driversError;

  const userIds = (drivers || []).map((d) => d.user_id).filter(Boolean);

  const [profilesResponse, vehicleAssignmentsResponse, emailsByUserId] = await Promise.all([
    supabase.from('profiles').select('id, phone').in('id', userIds),
    supabase.from('vehicles_with_driver').select('vehicle_id, rego, driver_id'),
    listDriverEmails(userIds as string[]).catch(() => ({}) as Record<string, string | null>),
  ]);

  if (profilesResponse.error) throw profilesResponse.error;
  if (vehicleAssignmentsResponse.error) throw vehicleAssignmentsResponse.error;

  const profileMap = new Map((profilesResponse.data || []).map((p) => [p.id, p]));
  const vehicleByDriverId = new Map(
    (vehicleAssignmentsResponse.data || [])
      .filter((a) => Boolean(a.driver_id))
      .map((a) => [a.driver_id as string, a])
  );

  return (drivers || []).map((d: any) => {
    const presence = Array.isArray(d.driver_presence) ? d.driver_presence[0] : d.driver_presence;
    const profile = profileMap.get(d.user_id);
    const assignment = vehicleByDriverId.get(d.id);

    return {
      driver_id: d.id,
      full_name: d.full_name,
      status: d.status,
      auth_user_id: d.user_id ?? null,
      email: (d.user_id && emailsByUserId[d.user_id]) || null,
      phone: profile?.phone || null,
      online_status: presence?.status || 'offline',
      current_vehicle_id: (assignment as any)?.vehicle_id || null,
      current_vehicle_rego: (assignment as any)?.rego || null,
      device_id: presence?.device_id || null,
      last_seen: presence?.last_seen || null,
    };
  });
}

export async function getDriver(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select(
      `
      id,
      full_name,
      status,
      user_id,
      profiles!drivers_user_id_fkey ( phone ),
      driver_presence!left ( device_id, status, last_seen )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const presence = Array.isArray((data as any).driver_presence)
    ? (data as any).driver_presence[0]
    : (data as any).driver_presence;
  const profile = (data as any).profiles;

  let email: string | null = null;
  if ((data as any).user_id) {
    const emails = await listDriverEmails([(data as any).user_id]).catch(() => ({}) as Record<string, string | null>);
    email = emails[(data as any).user_id] ?? null;
  }

  return {
    driver_id: data.id,
    full_name: data.full_name,
    status: data.status,
    auth_user_id: (data as any).user_id ?? null,
    email,
    phone: profile?.phone ?? null,
    online_status: presence?.status || 'offline',
    current_vehicle_id: null,
    current_vehicle_rego: null,
    device_id: presence?.device_id ?? null,
    last_seen: presence?.last_seen ?? null,
  };
}

export async function listDriverOptions(): Promise<Array<{ id: string; full_name: string | null }>> {
  const { data, error } = await supabase.from('drivers').select('id, full_name').order('full_name');
  if (error) throw error;
  return (data as Array<{ id: string; full_name: string | null }>) ?? [];
}

export async function sendDriverPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function countTotalDrivers(): Promise<number> {
  const { count, error } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function countActiveDrivers(): Promise<number> {
  const { count, error } = await supabase
    .from('drivers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}
