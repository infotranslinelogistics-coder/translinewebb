// Driver location data access layer (for live tracking)
import { supabase } from '../supabase';

export interface DriverLocation {
  id: string;
  driver_id: string;
  shift_id?: string | null;
  vehicle_id?: string | null;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
  recorded_at: string;
}

export async function listLatestLocationsByDrivers(driverIds?: string[]): Promise<DriverLocation[]> {
  const ids = Array.isArray(driverIds) ? driverIds : [];
  let query = supabase.from('view_driver_latest_location').select('*');
  if (ids.length > 0) {
    query = query.in('driver_id', ids);
  }

  const { data, error } = await query;
  if (error) {
    console.error('listLatestLocationsByDrivers error:', error);
    return [];
  }

  return (data as DriverLocation[]) || [];
}

export async function createLocationLog(
  log: Omit<DriverLocation, 'id' | 'recorded_at'>
): Promise<DriverLocation> {
  const { data, error } = await supabase
    .from('driver_locations')
    .insert([log])
    .select()
    .single();

  if (error) throw error;
  return data as DriverLocation;
}

export async function listDriverLocationsRange(
  driverId: string,
  startIso: string,
  endIso: string
): Promise<DriverLocation[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .gte('recorded_at', startIso)
    .lte('recorded_at', endIso)
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('listDriverLocationsRange error:', error);
    return [];
  }

  return (data as DriverLocation[]) || [];
}

export async function findNearestDriverLocation(
  driverId: string,
  targetIso: string,
  windowMinutes: number = 5
): Promise<DriverLocation | null> {
  const target = new Date(targetIso).getTime();
  const start = new Date(target - windowMinutes * 60 * 1000).toISOString();
  const end = new Date(target + windowMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .gte('recorded_at', start)
    .lte('recorded_at', end)
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('findNearestDriverLocation error:', error);
    return null;
  }

  const locations = (data as DriverLocation[]) ?? [];
  if (locations.length === 0) return null;

  let nearest = locations[0];
  let nearestDiff = Math.abs(new Date(nearest.recorded_at).getTime() - target);
  for (const loc of locations) {
    const diff = Math.abs(new Date(loc.recorded_at).getTime() - target);
    if (diff < nearestDiff) {
      nearest = loc;
      nearestDiff = diff;
    }
  }
  return nearest;
}

export function subscribeToLocationUpdates(
  callback: (log: DriverLocation) => void,
  onError?: (error: Error) => void
) {
  const subscription = supabase
    .channel('driver_locations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, (payload) => {
      callback(payload.new as DriverLocation);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to driver location updates');
      } else if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Failed to subscribe to driver location updates'));
      }
    });

  return subscription;
}
