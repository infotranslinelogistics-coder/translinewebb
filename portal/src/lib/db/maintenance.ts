// Maintenance data access layer
import { supabase } from '../supabase';

export interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  driver_id?: string | null;
  title?: string | null;
  service_type: string;
  service_date: string;
  scheduled_date?: string | null;
  odometer?: number;
  cost?: number;
  provider?: string;
  invoice_url?: string;
  notes?: string;
  status: 'due' | 'passed' | 'done' | 'pending' | 'completed' | 'cancelled' | 'overdue';
  acknowledged_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AdminInboxNotification {
  maintenance_item_id: string;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  current_km: number | null;
  target_service_km: number | null;
  km_remaining: number | null;
  created_at: string;
}

export interface ServiceAlert {
  maintenance_item_id: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  current_km: number | null;
  next_service_km: number | null;
  km_remaining: number | null;
  status: string | null;
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
    .neq('status', 'completed')
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

export async function listServiceAlerts(): Promise<ServiceAlert[]> {
  const { data, error } = await supabase
    .from('vehicle_service_alerts')
    .select('*');

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    maintenance_item_id: toText(row.maintenance_item_id),
    vehicle_id: toText(row.vehicle_id),
    vehicle_rego: toText(row.vehicle_rego) ?? toText(row.rego),
    current_km: toNumber(row.current_km) ?? toNumber(row.current_odometer),
    next_service_km: toNumber(row.next_service_km) ?? toNumber(row.service_due_km),
    km_remaining: toNumber(row.km_remaining),
    status: toText(row.status),
  }));
}

export async function listAdminInboxNotifications(): Promise<AdminInboxNotification[]> {
  const { data: maintenanceRows, error: maintenanceError } = await supabase
    .from('maintenance_items')
    .select('id, vehicle_id, created_at, status, service_type, acknowledged_at')
    .eq('status', 'due')
    .eq('service_type', 'Scheduled Service')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false });

  if (maintenanceError) throw maintenanceError;

  const rows = (maintenanceRows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const maintenanceItemIds = rows
    .map((row) => toText(row.id) ?? String(row.id))
    .filter((value): value is string => Boolean(value));

  const vehicleIds = rows
    .map((row) => toText(row.vehicle_id))
    .filter((value): value is string => Boolean(value));

  const [serviceAlertResponse, vehicleResponse] = await Promise.all([
    maintenanceItemIds.length > 0
      ? supabase
          .from('vehicle_service_alerts')
          .select('*')
          .in('maintenance_item_id', maintenanceItemIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase
          .from('vehicles')
          .select('id, rego')
          .in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (serviceAlertResponse.error) throw serviceAlertResponse.error;
  if (vehicleResponse.error) throw vehicleResponse.error;

  const alertsByMaintenanceId = new Map<string, ServiceAlert>();
  ((serviceAlertResponse.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const maintenanceItemId = toText(row.maintenance_item_id);
    if (!maintenanceItemId) return;

    alertsByMaintenanceId.set(maintenanceItemId, {
      maintenance_item_id: maintenanceItemId,
      vehicle_id: toText(row.vehicle_id),
      vehicle_rego: toText(row.vehicle_rego) ?? toText(row.rego),
      current_km: toNumber(row.current_km) ?? toNumber(row.current_odometer),
      next_service_km: toNumber(row.next_service_km) ?? toNumber(row.service_due_km),
      km_remaining: toNumber(row.km_remaining),
      status: toText(row.status),
    });
  });

  const regoByVehicleId = new Map<string, string>();
  ((vehicleResponse.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const id = toText(row.id);
    const rego = toText(row.rego);
    if (id && rego) {
      regoByVehicleId.set(id, rego);
    }
  });

  return rows.map((row) => {
    const maintenanceItemId = toText(row.id) ?? String(row.id);
    const vehicleId = toText(row.vehicle_id);
    const alert = alertsByMaintenanceId.get(maintenanceItemId);

    return {
      maintenance_item_id: maintenanceItemId,
      vehicle_id: vehicleId,
      vehicle_rego: alert?.vehicle_rego ?? (vehicleId ? regoByVehicleId.get(vehicleId) ?? null : null),
      current_km: alert?.current_km ?? null,
      target_service_km: alert?.next_service_km ?? null,
      km_remaining: alert?.km_remaining ?? null,
      created_at: toText(row.created_at) ?? new Date().toISOString(),
    };
  });
}

export async function acknowledgeMaintenanceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_items')
    .update({ acknowledged_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id);

  if (error) throw error;
}

export async function markMaintenanceItemCompleted(id: string): Promise<void> {
  const updatePayload: Record<string, unknown> = { status: 'completed' };
  // Attempt to set completed_at if the column exists; ignore the error if it doesn't
  const { error } = await supabase
    .from('maintenance_items')
    .update({ ...updatePayload, completed_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id);

  if (error) {
    // Retry without completed_at if the column doesn't exist
    const { error: retryError } = await supabase
      .from('maintenance_items')
      .update(updatePayload as Record<string, unknown>)
      .eq('id', id);
    if (retryError) throw retryError;
  }
}
