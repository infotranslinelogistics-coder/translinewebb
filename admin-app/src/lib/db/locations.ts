import { supabase } from '../supabase';

export interface DriverLocation {
  driver_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export async function listLatestLocationsByDrivers(driverIds?: string[]): Promise<DriverLocation[]> {
  let query = supabase
    .from('view_driver_latest_location')
    .select('driver_id, latitude, longitude, created_at');

  if (driverIds && driverIds.length > 0) {
    query = query.in('driver_id', driverIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error('listLatestLocationsByDrivers error:', error);
    return [];
  }
  return (data as DriverLocation[]) ?? [];
}

// Views don't emit postgres_changes — subscribe to the underlying shift_events
// table and resolve driver_id from metadata, mirroring the portal.
export function subscribeToLocationUpdates(callback: (row: DriverLocation) => void) {
  return supabase
    .channel('admin_location_updates')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'shift_events', filter: 'event_type=eq.location' },
      (payload) => {
        const row = payload.new as {
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          metadata: Record<string, unknown> | null;
        };
        const driver_id = (row.metadata?.driver_id as string) ?? null;
        if (!driver_id || row.latitude == null || row.longitude == null) return;
        callback({
          driver_id,
          latitude: row.latitude,
          longitude: row.longitude,
          created_at: row.created_at,
        });
      }
    )
    .subscribe();
}
