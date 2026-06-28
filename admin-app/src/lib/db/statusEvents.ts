import { supabase } from '../supabase';

export interface DriverStatusEvent {
  id: string;
  driver_id: string;
  shift_id: string | null;
  state: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export async function listDriverStatusEvents(
  driverId: string,
  page: number,
  pageSize = 10
): Promise<{ rows: DriverStatusEvent[]; count: number }> {
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from('driver_status_events')
    .select('*', { count: 'exact' })
    .eq('driver_id', driverId)
    .order('started_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { rows: (data as DriverStatusEvent[]) ?? [], count: count ?? 0 };
}

// Break counts per shift, used by the driver profile shifts tab.
export async function countBreaksByShift(shiftIds: string[]): Promise<Record<string, number>> {
  if (shiftIds.length === 0) return {};
  const { data, error } = await supabase
    .from('driver_status_events')
    .select('shift_id')
    .in('shift_id', shiftIds)
    .eq('state', 'break');

  if (error) throw error;
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    if (row.shift_id) counts[row.shift_id] = (counts[row.shift_id] ?? 0) + 1;
  });
  return counts;
}
