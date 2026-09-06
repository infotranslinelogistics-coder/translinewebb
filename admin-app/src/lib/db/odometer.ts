import { supabase } from '../supabase';

export interface OdometerReading {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_id: string | null;
  reading: number | null;
  photo_path: string | null;
  captured_at: string | null;
  created_at: string | null;
  lat: number | null;
  lng: number | null;
}

const COLUMNS = 'id, driver_id, vehicle_id, shift_id, reading, photo_path, captured_at, created_at, lat, lng';

export async function getLatestOdometerForVehicle(vehicleId: string): Promise<OdometerReading | null> {
  const { data, error } = await supabase
    .from('odometer_readings_feed')
    .select(COLUMNS)
    .eq('vehicle_id', vehicleId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OdometerReading) ?? null;
}

export async function getFirstOdometerForVehicle(vehicleId: string): Promise<OdometerReading | null> {
  const { data, error } = await supabase
    .from('odometer_readings_feed')
    .select(COLUMNS)
    .eq('vehicle_id', vehicleId)
    .order('captured_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OdometerReading) ?? null;
}

export async function getLatestOdometerForDriver(driverId: string): Promise<OdometerReading | null> {
  const { data, error } = await supabase
    .from('odometer_readings_feed')
    .select(COLUMNS)
    .eq('driver_id', driverId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OdometerReading) ?? null;
}

export async function listOdometerByDriver(
  driverId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: OdometerReading[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('odometer_readings_feed')
    .select(COLUMNS, { count: 'exact' })
    .eq('driver_id', driverId)
    .order('captured_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data as OdometerReading[]) ?? [], count: count ?? 0 };
}

export async function listOdometerByVehicle(
  vehicleId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: OdometerReading[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('odometer_readings_feed')
    .select(COLUMNS, { count: 'exact' })
    .eq('vehicle_id', vehicleId)
    .order('captured_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data as OdometerReading[]) ?? [], count: count ?? 0 };
}
