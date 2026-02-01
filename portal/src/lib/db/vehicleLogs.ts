import { supabase } from '@/lib/supabase';

export interface FuelLog {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_id: string | null;
  liters: number | null;
  cost: number | null;
  fuel_type: string | null;
  station_name: string | null;
  station_address: string | null;
  lat: number | null;
  lng: number | null;
  receipt_photo_path: string | null;
  noted_at: string;
  created_at: string;
  meta: Record<string, any>;
}

export interface MaintenanceLog {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_id: string | null;
  category: string;
  title: string;
  description: string | null;
  cost: number | null;
  odometer_value: number | null;
  vendor_name: string | null;
  vendor_address: string | null;
  lat: number | null;
  lng: number | null;
  photo_path: string | null;
  noted_at: string;
  created_at: string;
  meta: Record<string, any>;
}

export interface VehicleLogFilters {
  driverId?: string;
  vehicleId?: string;
  startDate?: string;
  endDate?: string;
  costMin?: number | null;
  costMax?: number | null;
  category?: string;
}

export async function listFuelLogs(filters: VehicleLogFilters, range?: { from: number; to: number }) {
  let query = supabase.from('fuel_logs').select('*', { count: 'exact' }).order('noted_at', { ascending: false });

  if (filters.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }
  if (filters.vehicleId) {
    query = query.eq('vehicle_id', filters.vehicleId);
  }
  if (filters.startDate) {
    query = query.gte('noted_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('noted_at', filters.endDate);
  }
  if (filters.costMin !== null && filters.costMin !== undefined) {
    query = query.gte('cost', filters.costMin);
  }
  if (filters.costMax !== null && filters.costMax !== undefined) {
    query = query.lte('cost', filters.costMax);
  }
  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data as FuelLog[]) ?? [], count: count ?? 0 };
}

export async function listMaintenanceLogs(filters: VehicleLogFilters, range?: { from: number; to: number }) {
  let query = supabase
    .from('maintenance_logs')
    .select('*', { count: 'exact' })
    .order('noted_at', { ascending: false });

  if (filters.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }
  if (filters.vehicleId) {
    query = query.eq('vehicle_id', filters.vehicleId);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.startDate) {
    query = query.gte('noted_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('noted_at', filters.endDate);
  }
  if (filters.costMin !== null && filters.costMin !== undefined) {
    query = query.gte('cost', filters.costMin);
  }
  if (filters.costMax !== null && filters.costMax !== undefined) {
    query = query.lte('cost', filters.costMax);
  }
  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data as MaintenanceLog[]) ?? [], count: count ?? 0 };
}
