import { supabase } from '../supabase';

export type ShiftChecklistValue = 'pass' | 'fail' | null;

export interface ShiftFull {
  id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  checklist?: Record<string, ShiftChecklistValue> | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  created_at?: string | null;
  driver_name: string | null;
  vehicle_rego: string | null;
}

export interface ShiftEvent {
  id: string;
  shift_id: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const SHIFT_FULL_COLUMNS =
  'id, driver_id, vehicle_id, status, started_at, ended_at, start_lat, start_lng, end_lat, end_lng, created_at, driver_name, vehicle_rego';

// Backfill any missing driver_name from the drivers table (mirrors portal).
async function enrichDriverNames(rows: ShiftFull[]): Promise<ShiftFull[]> {
  const missingIds = Array.from(
    new Set(rows.filter((r) => !r.driver_name && r.driver_id).map((r) => r.driver_id as string))
  );
  if (missingIds.length === 0) return rows;

  const { data } = await supabase.from('drivers').select('id, full_name').in('id', missingIds);
  const nameMap = new Map((data ?? []).map((d: any) => [d.id, d.full_name]));
  return rows.map((r) =>
    r.driver_name || !r.driver_id ? r : { ...r, driver_name: nameMap.get(r.driver_id) ?? null }
  );
}

export async function fetchShiftsFull(driverId?: string): Promise<ShiftFull[]> {
  let query = supabase.from('shifts_full').select(SHIFT_FULL_COLUMNS).order('started_at', { ascending: false });
  if (driverId) query = query.eq('driver_id', driverId);

  const { data, error } = await query;
  if (error) throw error;
  return enrichDriverNames((data as ShiftFull[]) ?? []);
}

export async function fetchShiftsFullByVehicle(
  vehicleId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: ShiftFull[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('shifts_full')
    .select(SHIFT_FULL_COLUMNS, { count: 'exact' })
    .eq('vehicle_id', vehicleId)
    .order('started_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: await enrichDriverNames((data as ShiftFull[]) ?? []), count: count ?? 0 };
}

export async function fetchShiftEvents(shiftId: string): Promise<ShiftEvent[]> {
  const { data, error } = await supabase
    .from('shift_events')
    .select('id, shift_id, event_type, latitude, longitude, metadata, created_at')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as ShiftEvent[]) ?? [];
}

export async function fetchShiftWithEvents(shiftId: string): Promise<{
  shift: ShiftFull | null;
  events: ShiftEvent[];
}> {
  const [shiftResponse, rawShiftResponse, events] = await Promise.all([
    supabase.from('shifts_full').select(SHIFT_FULL_COLUMNS).eq('id', shiftId).maybeSingle(),
    supabase.from('shifts').select('checklist').eq('id', shiftId).maybeSingle(),
    fetchShiftEvents(shiftId),
  ]);

  if (shiftResponse.error) throw shiftResponse.error;
  if (rawShiftResponse.error) throw rawShiftResponse.error;

  const shift = shiftResponse.data
    ? {
        ...(shiftResponse.data as ShiftFull),
        checklist:
          (rawShiftResponse.data as { checklist?: Record<string, ShiftChecklistValue> | null } | null)
            ?.checklist ?? null,
      }
    : null;

  return { shift, events };
}

export async function forceEndShift(shiftId: string, reason = 'Force ended by admin'): Promise<void> {
  const { error } = await supabase.rpc('force_end_shift', {
    p_shift_id: shiftId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function deleteShiftAdmin(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_shift_admin', { p_shift_id: shiftId });
  if (error) throw error;
}

// ─── Counts (dashboard + shift list stats) ────────────────────────────────
export async function countActiveShifts(): Promise<number> {
  const { count, error } = await supabase
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .or('status.eq.active,ended_at.is.null');
  if (error) throw error;
  return count ?? 0;
}

export async function countTodayShifts(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { count, error } = await supabase
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', start.toISOString())
    .lt('started_at', end.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function countDistinctDriversOnActiveShifts(): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .select('driver_id')
    .or('status.eq.active,ended_at.is.null')
    .not('driver_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.driver_id)).size;
}

export async function countDistinctVehiclesOnActiveShifts(): Promise<number> {
  const { data, error } = await supabase
    .from('shifts')
    .select('vehicle_id')
    .or('status.eq.active,ended_at.is.null')
    .not('vehicle_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.vehicle_id)).size;
}

export async function countForceEndedToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('shifts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'force_ended')
    .gte('ended_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

// Map of driver_id -> active shift started_at (for the drivers list duration).
export async function getActiveShiftsByDriver(): Promise<
  Map<string, { id: string; vehicle_id: string | null; started_at: string | null }>
> {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, driver_id, vehicle_id, started_at, ended_at, status')
    .or('status.eq.active,ended_at.is.null');
  if (error) throw error;
  const map = new Map<string, { id: string; vehicle_id: string | null; started_at: string | null }>();
  (data ?? []).forEach((row: any) => {
    if (row.driver_id && !map.has(row.driver_id)) {
      map.set(row.driver_id, { id: row.id, vehicle_id: row.vehicle_id, started_at: row.started_at });
    }
  });
  return map;
}
