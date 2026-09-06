import { supabase } from '../supabase';

export interface MaintenanceItem {
  id: string;
  vehicle_id: string;
  driver_id?: string | null;
  service_type: string;
  title?: string | null;
  service_date: string;
  scheduled_date?: string | null;
  odometer?: number | null;
  cost?: number | null;
  provider?: string | null;
  notes?: string | null;
  invoice_url?: string | null;
  metadata?: Record<string, unknown> | null;
  status: 'due' | 'passed' | 'done' | 'pending' | 'completed' | 'cancelled' | 'overdue' | string;
  acknowledged_at?: string | null;
  completed_at?: string | null;
}

export type NormalizedMaintenanceStatus = 'due' | 'passed' | 'done';

export function normalizeMaintenanceStatus(status: string | null | undefined): NormalizedMaintenanceStatus {
  const s = (status ?? '').toLowerCase();
  if (s === 'done' || s === 'completed') return 'done';
  if (s === 'passed' || s === 'overdue' || s === 'cancelled') return 'passed';
  return 'due';
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

export async function listMaintenanceByVehicle(
  vehicleId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: MaintenanceItem[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('maintenance_items')
    .select('id, service_type, service_date, odometer, cost, provider, notes, status', { count: 'exact' })
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data as MaintenanceItem[]) ?? [], count: count ?? 0 };
}

export async function countPendingMaintenance(): Promise<number> {
  const { count, error } = await supabase
    .from('maintenance_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['due', 'pending']);
  if (error) throw error;
  return count ?? 0;
}

function buildMutationPayload(input: {
  vehicle_id: string;
  driver_id?: string | null;
  service_type: string;
  date: string; // yyyy-mm-dd
  status: string;
}) {
  const iso = `${input.date}T00:00:00Z`;
  return {
    vehicle_id: input.vehicle_id,
    driver_id: input.driver_id ?? null,
    service_type: input.service_type,
    service_date: iso,
    scheduled_date: iso,
    status: input.status,
  };
}

// Create with a driver_id fallback (some deployments lack the column).
export async function createMaintenanceItem(input: {
  vehicle_id: string;
  driver_id?: string | null;
  service_type: string;
  date: string;
  status: string;
}): Promise<void> {
  const payload = buildMutationPayload(input);
  const { error } = await supabase.from('maintenance_items').insert([payload]);
  if (error) {
    if (error.message?.toLowerCase().includes('driver_id')) {
      const { driver_id: _omit, ...rest } = payload;
      const { error: retryError } = await supabase.from('maintenance_items').insert([rest]);
      if (retryError) throw retryError;
      return;
    }
    throw error;
  }
}

export async function updateMaintenanceItem(
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('maintenance_items').update(updates).eq('id', id);
  if (error) {
    if (error.message?.toLowerCase().includes('driver_id')) {
      const { driver_id: _omit, ...rest } = updates;
      const { error: retryError } = await supabase.from('maintenance_items').update(rest).eq('id', id);
      if (retryError) throw retryError;
      return;
    }
    throw error;
  }
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_items').delete().eq('id', id);
  if (error) throw error;
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

// ─── Service alerts (automatic, from vehicle_service_alerts view) ──────────
export interface ServiceAlert {
  maintenance_item_id: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  current_km: number | null;
  next_service_km: number | null;
  km_remaining: number | null;
  status: string | null;
}

export async function listServiceAlerts(): Promise<ServiceAlert[]> {
  const { data, error } = await supabase.from('vehicle_service_alerts').select('*');
  if (error) {
    const code = (error as any).code ?? '';
    const message = (error.message ?? '').toLowerCase();
    if (['401', '403', '42501'].includes(String(code)) || message.includes('permission') || message.includes('jwt')) {
      return [];
    }
    throw error;
  }

  const rows = (data ?? []) as any[];
  const mapped: ServiceAlert[] = rows.map((r) => ({
    maintenance_item_id: r.maintenance_item_id ?? null,
    vehicle_id: r.vehicle_id ?? null,
    vehicle_rego: r.vehicle_rego ?? r.rego ?? null,
    current_km: r.current_km ?? r.current_odometer ?? null,
    next_service_km: r.next_service_km ?? r.service_due_km ?? r.next_service_odometer ?? null,
    km_remaining: r.km_remaining ?? null,
    status: r.status ?? null,
  }));

  return mapped.filter((a) => a.maintenance_item_id != null && (a.status ?? '') !== 'completed');
}

// Inbox notifications for the dashboard service-due banner.
export interface InboxNotification {
  id: string;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  service_type: string | null;
  current_km: number | null;
  next_service_km: number | null;
  km_remaining: number | null;
  created_at: string;
}

export async function listAdminInboxNotifications(): Promise<InboxNotification[]> {
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('id, vehicle_id, created_at, status, service_type, acknowledged_at, metadata')
    .eq('status', 'due')
    .eq('service_type', 'Scheduled Service')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[maintenance] inbox notifications failed', error.message);
    return [];
  }

  const items = (data ?? []) as any[];
  if (items.length === 0) return [];

  const vehicleIds = Array.from(new Set(items.map((i) => i.vehicle_id).filter(Boolean)));
  const [vehicleResult, alertResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from('vehicles').select('id, rego').in('id', vehicleIds)
      : Promise.resolve({ data: [] as any[] }),
    listServiceAlerts().catch(() => [] as ServiceAlert[]),
  ]);

  const regoMap = new Map(((vehicleResult.data as any[]) ?? []).map((v) => [v.id, v.rego]));
  const alertByItem = new Map((alertResult as ServiceAlert[]).map((a) => [a.maintenance_item_id, a]));

  return items.map((i) => {
    const alert = alertByItem.get(i.id);
    return {
      id: i.id,
      vehicle_id: i.vehicle_id ?? null,
      vehicle_rego: regoMap.get(i.vehicle_id) ?? null,
      service_type: i.service_type ?? null,
      current_km: alert?.current_km ?? (i.metadata?.current_km as number | undefined) ?? null,
      next_service_km: alert?.next_service_km ?? (i.metadata?.next_service_km as number | undefined) ?? null,
      km_remaining: alert?.km_remaining ?? null,
      created_at: i.created_at,
    };
  });
}
