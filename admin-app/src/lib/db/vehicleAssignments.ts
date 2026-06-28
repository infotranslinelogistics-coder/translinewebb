import { supabase } from '../supabase';

export interface VehicleAssignmentRow {
  id: string;
  driver_id: string;
  vehicle_id: string;
  assigned_at: string;
  unassigned_at: string | null;
}

export async function listAssignmentsByDriver(
  driverId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: VehicleAssignmentRow[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('vehicle_assignments')
    .select('*', { count: 'exact' })
    .eq('driver_id', driverId)
    .order('assigned_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data as VehicleAssignmentRow[]) ?? [], count: count ?? 0 };
}
