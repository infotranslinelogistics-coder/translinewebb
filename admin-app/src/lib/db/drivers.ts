import { supabase } from '../supabase';

export interface Driver {
  driver_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  online_status: 'online' | 'offline' | string | null;
  current_vehicle_rego: string | null;
}

export async function listDrivers(): Promise<Driver[]> {
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select(`
      id,
      full_name,
      status,
      user_id,
      driver_presence!left ( status, last_seen )
    `)
    .order('full_name', { ascending: true });

  if (driversError) throw driversError;

  const userIds = (drivers || []).map((d) => d.user_id).filter(Boolean);

  const [profilesResponse, vehicleAssignmentsResponse] = await Promise.all([
    supabase.from('profiles').select('id, phone, email').in('id', userIds),
    supabase.from('vehicles_with_driver').select('rego, driver_id'),
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
      email: profile?.email || null,
      phone: profile?.phone || null,
      online_status: presence?.status || 'offline',
      current_vehicle_rego: assignment?.rego || null,
    };
  });
}

export async function getDriver(id: string): Promise<Driver | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      id,
      full_name,
      status,
      user_id,
      profiles!drivers_user_id_fkey ( phone, email ),
      driver_presence!left ( status, last_seen )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const presence = Array.isArray((data as any).driver_presence)
    ? (data as any).driver_presence[0]
    : (data as any).driver_presence;
  const profile = (data as any).profiles;

  return {
    driver_id: data.id,
    full_name: data.full_name,
    status: data.status,
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
    online_status: presence?.status || 'offline',
    current_vehicle_rego: null,
  };
}
