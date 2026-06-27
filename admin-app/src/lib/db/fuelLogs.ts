import { supabase } from '../supabase';
import { getSignedStorageUrl } from '../storage';

export interface FuelLogRow {
  id: string;
  shift_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  driver_name: string | null;
  vehicle_rego: string | null;
  litres: number | null;
  cost: number | null;
  odometer_km: number | null;
  station_name: string | null;
  receipt_url: string | null;
  reviewed: boolean;
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

function getReceiptPath(metadata: Record<string, unknown>): string | null {
  const direct = toText(metadata.receipt_photo_path);
  if (direct) return direct;

  const legacy = metadata.receipt_urls;
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy.map(toText).find((entry): entry is string => Boolean(entry)) ?? null;
  }
  if (typeof legacy === 'string') return toText(legacy);
  return null;
}

function isReviewed(metadata: Record<string, unknown>): boolean {
  return metadata.reviewed === true || metadata.seen === true || typeof metadata.reviewed_at === 'string';
}

export async function listFuelLogs(): Promise<FuelLogRow[]> {
  const { data, error } = await supabase
    .from('shift_events')
    .select('id, shift_id, created_at, metadata, latitude, longitude')
    .eq('event_type', 'fuel_log')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const shiftIds = Array.from(new Set(rows.map((row) => toText(row.shift_id)).filter((v): v is string => Boolean(v))));
  const { data: shifts, error: shiftsError } = shiftIds.length
    ? await supabase.from('shifts_full').select('id, driver_name, vehicle_rego').in('id', shiftIds)
    : { data: [], error: null };
  if (shiftsError) throw shiftsError;

  const shiftById = new Map(
    ((shifts ?? []) as Record<string, unknown>[]).map((row) => [toText(row.id), row])
  );

  const mapped = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const shift = shiftById.get(toText(row.shift_id));
    return {
      id: String(row.id),
      shift_id: toText(row.shift_id) ?? '',
      created_at: toText(row.created_at) ?? new Date().toISOString(),
      metadata,
      driver_name: toText(shift?.driver_name) ?? null,
      vehicle_rego: toText(shift?.vehicle_rego) ?? null,
      litres: toNumber(metadata.litres),
      cost: toNumber(metadata.cost),
      odometer_km: toNumber(metadata.odometer_km),
      station_name: toText(metadata.station_name) ?? toText(metadata.location_name),
      receipt_url: null as string | null,
      reviewed: isReviewed(metadata),
    };
  });

  return Promise.all(
    mapped.map(async (row) => ({
      ...row,
      receipt_url: await getSignedStorageUrl({ filePath: getReceiptPath(row.metadata), bucket: 'fuel_receipts' }),
    }))
  );
}

export async function toggleFuelLogReviewed(row: FuelLogRow): Promise<void> {
  const nextMetadata = {
    ...row.metadata,
    reviewed: !row.reviewed,
    seen: !row.reviewed,
    reviewed_at: !row.reviewed ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from('shift_events').update({ metadata: nextMetadata }).eq('id', row.id);
  if (error) throw error;
}

export async function deleteFuelLog(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_fuel_log_admin', { p_event_id: eventId });
  if (error) throw error;
}
