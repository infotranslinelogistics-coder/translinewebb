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

export async function fetchShiftsFull(): Promise<ShiftFull[]> {
  const { data, error } = await supabase
    .from('shifts_full')
    .select(
      'id, driver_id, vehicle_id, status, started_at, ended_at, start_lat, start_lng, end_lat, end_lng, driver_name, vehicle_rego'
    )
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as ShiftFull[]) ?? [];
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
    supabase
      .from('shifts_full')
      .select(
        'id, driver_id, vehicle_id, status, started_at, ended_at, start_lat, start_lng, end_lat, end_lng, driver_name, vehicle_rego'
      )
      .eq('id', shiftId)
      .maybeSingle(),
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

export async function forceEndShift(shiftId: string): Promise<void> {
  const { error } = await supabase.rpc('force_end_shift', { p_shift_id: shiftId });
  if (error) throw error;
}
