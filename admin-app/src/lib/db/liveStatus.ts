import { supabase } from '../supabase';

export interface DriverCurrentStatus {
  driver_id: string;
  last_seen_at: string | null;
  is_online: boolean | null;
  status_state: string | null;
  on_break: boolean | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  vehicle_id: string | null;
}

export async function listDriverCurrentStatus(): Promise<DriverCurrentStatus[]> {
  const { data, error } = await supabase.from('view_driver_current_status').select('*');
  if (error) throw error;
  return (data || []) as DriverCurrentStatus[];
}
