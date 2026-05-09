// Maintenance data access layer
import { supabase } from '../supabase';

export interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  driver_id?: string | null;
  service_type: string;
  service_date: string;
  scheduled_date?: string | null;
  odometer?: number;
  cost?: number;
  provider?: string;
  invoice_url?: string;
  notes?: string;
  status: 'due' | 'passed' | 'done' | 'pending' | 'completed' | 'cancelled' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface MaintenanceAlert {
  id: string;
  status: string;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  current_odometer: number | null;
  service_due_km: number | null;
  km_remaining: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const mapAlertRow = (row: Record<string, unknown>): MaintenanceAlert => {
  const metadata = toRecord(row.metadata);

  return {
    id: String(row.id),
    status: toText(row.status) ?? 'open',
    vehicle_id: toText(row.vehicle_id) ?? toText(metadata?.vehicle_id),
    vehicle_rego:
      toText(row.vehicle_rego) ??
      toText(row.rego) ??
      toText(metadata?.vehicle_rego) ??
      toText(metadata?.rego),
    current_odometer:
      toNumber(row.current_odometer) ??
      toNumber(row.current_odometer_km) ??
      toNumber(metadata?.current_odometer) ??
      toNumber(metadata?.current_odometer_km),
    service_due_km:
      toNumber(row.service_due_km) ??
      toNumber(row.next_service_odometer) ??
      toNumber(metadata?.service_due_km) ??
      toNumber(metadata?.next_service_odometer),
    km_remaining:
      toNumber(row.km_remaining) ??
      toNumber(metadata?.km_remaining) ??
      (() => {
        const due =
          toNumber(row.service_due_km) ??
          toNumber(row.next_service_odometer) ??
          toNumber(metadata?.service_due_km) ??
          toNumber(metadata?.next_service_odometer);
        const current =
          toNumber(row.current_odometer) ??
          toNumber(row.current_odometer_km) ??
          toNumber(metadata?.current_odometer) ??
          toNumber(metadata?.current_odometer_km);
        if (due == null || current == null) return null;
        return due - current;
      })(),
    created_at: toText(row.created_at) ?? new Date().toISOString(),
    metadata,
  };
};

export async function listMaintenanceItems(): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .order('service_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listPendingMaintenanceItems(): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .in('status', ['due', 'pending'])
    .order('service_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getMaintenanceItem(id: string): Promise<MaintenanceItem | null> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function createMaintenanceItem(item: Omit<MaintenanceItem, 'id' | 'created_at' | 'updated_at'>): Promise<MaintenanceItem> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .insert([item])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMaintenanceItem(id: string, updates: Partial<MaintenanceItem>): Promise<MaintenanceItem> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function countPendingMaintenance(): Promise<number> {
  const { count, error } = await supabase
    .from('maintenance_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['due', 'pending']);

  if (error) throw error;
  return count || 0;
}

export async function listByVehicleId(vehicleId: string): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function generateMaintenanceAlerts(): Promise<void> {
  const { error } = await supabase.rpc('generate_maintenance_alerts');
  if (error) throw error;
}

export async function listOpenMaintenanceAlerts(): Promise<MaintenanceAlert[]> {
  const { data, error } = await supabase
    .from('maintenance_alerts')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map(mapAlertRow);
}

export async function acknowledgeMaintenanceAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_alerts')
    .update({ status: 'acknowledged' })
    .eq('id', alertId);

  if (error) throw error;
}

export async function completeMaintenanceAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_alerts')
    .update({ status: 'completed' })
    .eq('id', alertId);

  if (error) throw error;
}
