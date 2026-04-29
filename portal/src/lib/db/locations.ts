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

  console.log('listLatestLocationsByDrivers data:', data);
  return (data as DriverLocation[]) ?? [];
}

// Real-time: subscribe to shift_events (source table the view reads from)
// Views don't emit postgres_changes — must listen on the underlying table
export function subscribeToLocationUpdates(callback: (row: DriverLocation) => void) {
  return supabase
    .channel('location_updates')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'shift_events',
        filter: 'event_type=eq.location',
      },
      (payload) => {
        const row = payload.new as {
          shift_id: string;
          latitude: number;
          longitude: number;
          created_at: string;
          metadata: Record<string, unknown> | null;
        };

        // shift_events has no driver_id — resolve via metadata or a shifts lookup
        // if your app writes driver_id into metadata, use that:
        const driver_id = (row.metadata?.driver_id as string) ?? null;
        if (!driver_id || !row.latitude || !row.longitude) return;

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