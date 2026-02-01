import { supabase } from '@/lib/supabase';
import type { DriverLocation } from '@/lib/db/locations';

export interface DriverStop {
  id: string;
  driver_id: string;
  shift_id: string | null;
  vehicle_id: string | null;
  start_at: string;
  end_at: string;
  duration_seconds: number;
  lat: number;
  lng: number;
  radius_m: number | null;
  source: string;
  meta: Record<string, any>;
}

export interface StopComputationOptions {
  speedThresholdKmh?: number;
  radiusMeters?: number;
  minDurationSeconds?: number;
}

export async function computeDriverStops(
  driverId: string,
  startIso: string,
  endIso: string
): Promise<DriverStop[]> {
  const { data, error } = await supabase.rpc('compute_driver_stops', {
    driver_id: driverId,
    start_ts: startIso,
    end_ts: endIso,
  });

  if (error) {
    console.warn('compute_driver_stops RPC failed, falling back to stored stops', error.message);
    const { data: fallback, error: fallbackError } = await supabase
      .from('driver_stops')
      .select('*')
      .eq('driver_id', driverId)
      .gte('start_at', startIso)
      .lte('end_at', endIso)
      .order('start_at', { ascending: true });
    if (fallbackError) {
      console.error('Failed to fetch driver_stops', fallbackError.message);
      return [];
    }
    return (fallback as DriverStop[]) ?? [];
  }

  return (data as DriverStop[]) ?? [];
}

export function computeStopsFromLocations(
  locations: DriverLocation[],
  options: StopComputationOptions = {}
): DriverStop[] {
  const speedThreshold = options.speedThresholdKmh ?? 2;
  const radiusMeters = options.radiusMeters ?? 50;
  const minDurationSeconds = options.minDurationSeconds ?? 120;
  const sorted = [...locations].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const stops: DriverStop[] = [];
  let currentStart: DriverLocation | null = null;
  let currentEnd: DriverLocation | null = null;
  let anchor: DriverLocation | null = null;

  const distanceMeters = (a: DriverLocation, b: DriverLocation) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * r * Math.asin(Math.sqrt(h));
  };

  const finalizeStop = () => {
    if (!currentStart || !currentEnd || !anchor) return;
    const durationSeconds = Math.round(
      (new Date(currentEnd.recorded_at).getTime() - new Date(currentStart.recorded_at).getTime()) / 1000
    );
    if (durationSeconds < minDurationSeconds) return;
    stops.push({
      id: `${currentStart.id}-${currentEnd.id}`,
      driver_id: currentStart.driver_id,
      shift_id: currentStart.shift_id ?? null,
      vehicle_id: currentStart.vehicle_id ?? null,
      start_at: currentStart.recorded_at,
      end_at: currentEnd.recorded_at,
      duration_seconds: durationSeconds,
      lat: anchor.lat,
      lng: anchor.lng,
      radius_m: radiusMeters,
      source: 'client',
      meta: {},
    });
  };

  sorted.forEach((loc) => {
    const speed = loc.speed_kmh ?? 0;
    if (speed <= speedThreshold) {
      if (!currentStart) {
        currentStart = loc;
        currentEnd = loc;
        anchor = loc;
        return;
      }
      if (anchor && distanceMeters(anchor, loc) <= radiusMeters) {
        currentEnd = loc;
      } else {
        finalizeStop();
        currentStart = loc;
        currentEnd = loc;
        anchor = loc;
      }
    } else if (currentStart) {
      finalizeStop();
      currentStart = null;
      currentEnd = null;
      anchor = null;
    }
  });

  finalizeStop();

  return stops;
}
