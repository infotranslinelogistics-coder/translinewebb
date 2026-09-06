import { supabase } from '../supabase';

export interface DriverCurrentStatus {
  driver_id: string;
  last_seen_at: string | null;
  is_online: boolean | null;
  status_state: string | null;
  on_break: boolean | null;
  status_started_at?: string | null;
  last_location_at?: string | null;
  lat: number | null;
  lng: number | null;
  speed_kmh?: number | null;
  heading: number | null;
  vehicle_id: string | null;
  shift_id?: string | null;
}

export async function listDriverCurrentStatus(): Promise<DriverCurrentStatus[]> {
  const { data, error } = await supabase.from('view_driver_current_status').select('*');
  if (error) throw error;
  return (data || []) as DriverCurrentStatus[];
}

export async function getDriverCurrentStatus(driverId: string): Promise<DriverCurrentStatus | null> {
  const { data, error } = await supabase
    .from('view_driver_current_status')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle();
  if (error) throw error;
  return (data as DriverCurrentStatus) ?? null;
}

// Realtime GPS for a single driver (driver/vehicle profile live map).
export function subscribeDriverGps(
  driverId: string,
  handlers: {
    onStatus?: (status: Partial<DriverCurrentStatus>) => void;
    onLocation?: (loc: { latitude: number; longitude: number; created_at: string }) => void;
  }
) {
  return supabase
    .channel(`admin-driver-gps-${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'view_driver_current_status',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => handlers.onStatus?.(payload.new as Partial<DriverCurrentStatus>)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        const row = payload.new as { latitude: number; longitude: number; created_at: string };
        handlers.onLocation?.(row);
      }
    )
    .subscribe();
}
