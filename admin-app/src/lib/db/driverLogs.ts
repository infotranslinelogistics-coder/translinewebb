import { supabase } from '../supabase';
import { getSignedStorageUrl } from '../storage';

export type DriverLogCategory = 'incident' | 'maintenance' | 'accident' | 'general';

export interface DriverLogRow {
  id: string;
  shift_id: string | null;
  driver_name: string | null;
  vehicle_rego: string | null;
  description: string;
  category: DriverLogCategory;
  severity: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
}

const toText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function normalizeCategory(value: unknown): DriverLogCategory {
  const text = (toText(value) ?? '').toLowerCase();
  if (text.includes('incident')) return 'incident';
  if (text.includes('maintenance')) return 'maintenance';
  if (text.includes('accident')) return 'accident';
  return 'general';
}

function mapRow(row: Record<string, unknown>): Omit<DriverLogRow, 'photo_url'> & { photo_path: string | null } {
  const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;

  return {
    id: String(row.id),
    shift_id: toText(row.shift_id),
    driver_name: toText(row.driver_name) ?? toText(metadata.driver_name),
    vehicle_rego: toText(row.vehicle_rego) ?? toText(row.vehicle_plate) ?? toText(metadata.vehicle_rego),
    description: toText(row.description) ?? toText(row.notes) ?? toText(metadata.description) ?? '—',
    category: normalizeCategory(row.category ?? row.log_type ?? row.type ?? row.event_type ?? metadata.category),
    severity: toText(row.severity) ?? toText(metadata.severity) ?? 'low',
    created_at: toText(row.created_at) ?? new Date().toISOString(),
    latitude: toNumber(row.latitude) ?? toNumber(metadata.latitude),
    longitude: toNumber(row.longitude) ?? toNumber(metadata.longitude),
    photo_path: toText(row.photo_path) ?? toText(metadata.photo_path),
  };
}

export async function listDriverLogs(): Promise<DriverLogRow[]> {
  const { data: viewData, error: viewError } = await supabase
    .from('driver_logs_admin')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  let sourceRows: Record<string, unknown>[];

  if (viewError) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('shift_events')
      .select('id, shift_id, created_at, metadata, latitude, longitude')
      .eq('event_type', 'driver_log')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fallbackError) throw fallbackError;
    sourceRows = (fallbackData ?? []) as Record<string, unknown>[];
  } else {
    sourceRows = (viewData ?? []) as Record<string, unknown>[];
  }

  const mapped = sourceRows.map(mapRow);

  return Promise.all(
    mapped.map(async ({ photo_path, ...row }) => ({
      ...row,
      photo_url: await getSignedStorageUrl({ filePath: photo_path, bucket: 'driver_log_photos' }),
    }))
  );
}

export async function deleteDriverLog(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_driver_log_admin', { p_event_id: eventId });
  if (error) throw error;
}
