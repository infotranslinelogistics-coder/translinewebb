import { supabase } from '../supabase';

export interface OdometerShiftRow {
  shift_id: string;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  start_captured_at: string | null;
  end_captured_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  start_photo_path: string | null;
  end_photo_path: string | null;
  shift_status?: string | null;
  shift_ended_at?: string | null;
  // resolved client-side
  start_photo_url?: string | null;
  end_photo_url?: string | null;
  start_photo_error?: string | null;
  end_photo_error?: string | null;
}

const COLUMNS =
  'shift_id, driver_id, driver_name, vehicle_id, vehicle_rego, start_captured_at, end_captured_at, odometer_start, odometer_end, start_photo_path, end_photo_path';

export interface OdometerLogFilters {
  driverId?: string | null;
  vehicleId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listOdometerShiftRows(
  filters: OdometerLogFilters
): Promise<{ rows: OdometerShiftRow[]; count: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('odometer_readings_admin')
    .select(COLUMNS, { count: 'exact' })
    .order('start_captured_at', { ascending: false, nullsFirst: false });

  if (filters.driverId) query = query.eq('driver_id', filters.driverId);
  if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
  if (filters.startDate) query = query.gte('start_captured_at', filters.startDate);
  if (filters.endDate) query = query.lte('start_captured_at', filters.endDate);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  const rows = (data as OdometerShiftRow[]) ?? [];

  // Hydrate completion state from the shifts table.
  const shiftIds = rows.map((r) => r.shift_id).filter(Boolean);
  if (shiftIds.length > 0) {
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('id, status, ended_at')
      .in('id', shiftIds);
    const shiftMap = new Map(
      (shiftData ?? []).map((s: any) => [s.id, s as { status: string | null; ended_at: string | null }])
    );
    rows.forEach((row) => {
      const s = shiftMap.get(row.shift_id);
      if (s) {
        row.shift_status = s.status;
        row.shift_ended_at = s.ended_at;
      }
    });
  }

  return { rows, count: count ?? 0 };
}

export function isShiftCompleted(row: OdometerShiftRow): boolean {
  return (
    Boolean(row.shift_ended_at) ||
    ['ended', 'completed', 'cancelled'].includes((row.shift_status ?? '').toLowerCase())
  );
}

export async function getCurrentOdometer(
  vehicleId: string
): Promise<{ value: number | null; recordedAt: string | null }> {
  const { data, error } = await supabase
    .from('vehicle_latest_odometer')
    .select('latest_odometer_value, latest_recorded_at')
    .eq('vehicle_id', vehicleId)
    .single();

  if (error) {
    // PGRST116 = no rows; treat as "no reading yet"
    return { value: null, recordedAt: null };
  }
  return {
    value: (data?.latest_odometer_value as number | null) ?? null,
    recordedAt: (data?.latest_recorded_at as string | null) ?? null,
  };
}
