import { supabase } from '../supabase';

export interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  driver_id?: string | null;
  service_type: string;
  service_date: string;
  odometer?: number;
  cost?: number;
  provider?: string;
  notes?: string;
  status: 'due' | 'passed' | 'done' | 'pending' | 'completed' | 'cancelled' | 'overdue';
  acknowledged_at?: string | null;
}

export async function listMaintenanceItems(): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .neq('status', 'completed')
    .order('service_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function acknowledgeMaintenanceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_items')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function markMaintenanceItemCompleted(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_items')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    const { error: retryError } = await supabase
      .from('maintenance_items')
      .update({ status: 'completed' })
      .eq('id', id);
    if (retryError) throw retryError;
  }
}
