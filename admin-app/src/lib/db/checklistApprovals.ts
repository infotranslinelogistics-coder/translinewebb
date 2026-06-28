import { supabase } from '../supabase';

export type ChecklistApprovalStatus = 'pending' | 'approved' | 'rejected' | string;

export type ChecklistFailedItem = {
  key: string;
  sectionTitle: string | null;
  label: string;
  notes: string | null;
  critical: boolean;
};

export type NormalizedChecklistEntry = {
  key: string;
  label: string;
  status: 'pass' | 'fail' | 'pending';
  notes: string | null;
};

export interface ChecklistApprovalRequest {
  request_id: string;
  shift_id: string | null;
  requested_at: string;
  status: ChecklistApprovalStatus;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_rego: string | null;
  failed_items_count: number;
  failed_items: ChecklistFailedItem[];
  admin_note: string | null;
  note_visible_to_driver: boolean;
  raw_checklist: NormalizedChecklistEntry[];
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatChecklistLabel = (key: string) =>
  key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeFailedItems = (raw: unknown): ChecklistFailedItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!isRecord(entry)) return null;

      const key =
        toText(entry.id) ?? toText(entry.key) ?? toText(entry.item_key) ?? toText(entry.field) ?? `failed_item_${index}`;

      const label = toText(entry.label) ?? toText(entry.item_label) ?? toText(entry.title) ?? formatChecklistLabel(key);

      const sectionTitle = toText(entry.sectionTitle) ?? toText(entry.section_title) ?? toText(entry.section) ?? null;

      const criticalRaw = entry.critical;
      const critical =
        typeof criticalRaw === 'boolean'
          ? criticalRaw
          : typeof criticalRaw === 'string'
            ? ['true', '1', 'yes', 'critical'].includes(criticalRaw.trim().toLowerCase())
            : false;

      return {
        key,
        sectionTitle,
        label,
        notes: toText(entry.notes) ?? toText(entry.note) ?? toText(entry.comment) ?? null,
        critical,
      } as ChecklistFailedItem;
    })
    .filter((entry): entry is ChecklistFailedItem => Boolean(entry));
};

const normalizeChecklistStatus = (value: unknown): 'pass' | 'fail' | 'pending' => {
  const s = (typeof value === 'string' ? value : '').trim().toLowerCase();
  if (['pass', 'passed', 'ok', 'yes', 'true', 'good'].includes(s)) return 'pass';
  if (['fail', 'failed', 'no', 'false', 'bad'].includes(s)) return 'fail';
  return 'pending';
};

// Normalize a raw checklist snapshot (object map or array) into display rows.
const parseChecklistFromRow = (row: Record<string, unknown>): NormalizedChecklistEntry[] => {
  const metadata = toRecord(row.metadata);
  const source =
    row.checklist_payload ??
    row.checklist_snapshot ??
    row.checklist ??
    row.raw_checklist ??
    metadata?.checklist_payload ??
    metadata?.checklist_snapshot ??
    metadata?.checklist ??
    metadata?.answers ??
    null;

  if (Array.isArray(source)) {
    return source
      .map((entry, index) => {
        if (!isRecord(entry)) return null;
        const key = toText(entry.id) ?? toText(entry.key) ?? `item_${index}`;
        return {
          key,
          label: toText(entry.label) ?? toText(entry.title) ?? formatChecklistLabel(key),
          status: normalizeChecklistStatus(entry.status ?? entry.value),
          notes: toText(entry.notes) ?? toText(entry.note) ?? null,
        } as NormalizedChecklistEntry;
      })
      .filter((entry): entry is NormalizedChecklistEntry => Boolean(entry));
  }

  if (isRecord(source)) {
    return Object.entries(source).map(([key, value]) => {
      if (isRecord(value)) {
        return {
          key,
          label: toText(value.label) ?? formatChecklistLabel(key),
          status: normalizeChecklistStatus(value.status ?? value.value),
          notes: toText(value.note) ?? toText(value.notes) ?? null,
        } as NormalizedChecklistEntry;
      }
      return {
        key,
        label: formatChecklistLabel(key),
        status: normalizeChecklistStatus(value),
        notes: null,
      } as NormalizedChecklistEntry;
    });
  }

  return [];
};

const mapApprovalRow = (
  row: Record<string, unknown>,
  driverNameById: Map<string, string>,
  regoByVehicleId: Map<string, string>
): ChecklistApprovalRequest => {
  const requestId = toText(row.request_id) ?? toText(row.id) ?? toText(row.approval_id) ?? '';
  const driverId = toText(row.driver_id) ?? toText(row.requested_by_driver_id) ?? null;
  const vehicleId = toText(row.vehicle_id) ?? null;

  const failedItems = normalizeFailedItems(row.failed_items ?? toRecord(row.metadata)?.failed_items ?? []);

  return {
    request_id: requestId,
    shift_id: toText(row.shift_id) ?? null,
    requested_at: toText(row.requested_at) ?? toText(row.created_at) ?? new Date().toISOString(),
    status: toText(row.status) ?? 'pending',
    driver_id: driverId,
    driver_name: toText(row.driver_name) ?? (driverId ? driverNameById.get(driverId) ?? null : null),
    vehicle_id: vehicleId,
    vehicle_rego: toText(row.vehicle_rego) ?? toText(row.rego) ?? (vehicleId ? regoByVehicleId.get(vehicleId) ?? null : null),
    failed_items_count: failedItems.length,
    failed_items: failedItems,
    admin_note:
      toText(row.admin_note) ??
      toText(row.review_note) ??
      toText(row.note) ??
      toText(toRecord(row.metadata)?.admin_note) ??
      null,
    note_visible_to_driver: row.note_visible_to_driver === true,
    raw_checklist: parseChecklistFromRow(row),
  };
};

const isPendingStatus = (status: string | null | undefined) => {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'requested' || normalized === 'awaiting_approval';
};

export async function listChecklistApprovals(): Promise<ChecklistApprovalRequest[]> {
  const { data, error } = await supabase
    .from('checklist_approvals')
    .select('*')
    .order('requested_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const driverIds = Array.from(
    new Set(rows.map((row) => toText(row.driver_id) ?? toText(row.requested_by_driver_id)).filter((v): v is string => Boolean(v)))
  );
  const vehicleIds = Array.from(new Set(rows.map((row) => toText(row.vehicle_id)).filter((v): v is string => Boolean(v))));

  const [driversResponse, vehiclesResponse] = await Promise.all([
    driverIds.length > 0
      ? supabase.from('drivers').select('id, full_name').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase.from('vehicles').select('id, rego').in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResponse.error) throw driversResponse.error;
  if (vehiclesResponse.error) throw vehiclesResponse.error;

  const driverNameById = new Map<string, string>(
    ((driversResponse.data ?? []) as Record<string, unknown>[])
      .map((row) => [toText(row.id), toText(row.full_name)])
      .filter(([id, name]) => id && name) as [string, string][]
  );
  const regoByVehicleId = new Map<string, string>(
    ((vehiclesResponse.data ?? []) as Record<string, unknown>[])
      .map((row) => [toText(row.id), toText(row.rego)])
      .filter(([id, rego]) => id && rego) as [string, string][]
  );

  return rows
    .map((row) => mapApprovalRow(row, driverNameById, regoByVehicleId))
    .filter((row) => row.request_id.length > 0);
}

export async function listPendingChecklistApprovals(): Promise<ChecklistApprovalRequest[]> {
  const rows = await listChecklistApprovals();
  return rows.filter((row) => isPendingStatus(row.status));
}

export async function countPendingChecklistApprovals(): Promise<number> {
  const rows = await listChecklistApprovals();
  return rows.filter((row) => isPendingStatus(row.status)).length;
}

// Tolerates a missing migration: swallow errors so approve/reject still works.
async function applyNoteVisibility(requestId: string, visible: boolean): Promise<void> {
  try {
    await supabase.rpc('set_checklist_note_visibility', {
      p_request_id: requestId,
      p_visible: visible,
    });
  } catch (err) {
    console.warn('[checklist] set_checklist_note_visibility unavailable', err);
  }
}

export async function approveChecklistRequest(
  requestId: string,
  note: string,
  noteVisibleToDriver = false
): Promise<void> {
  const { error } = await supabase.rpc('approve_checklist_request', {
    p_request_id: requestId,
    p_admin_note: note || null,
  });
  if (error) throw error;
  await applyNoteVisibility(requestId, noteVisibleToDriver);
}

export async function rejectChecklistRequest(
  requestId: string,
  note: string,
  noteVisibleToDriver = false
): Promise<void> {
  const { error } = await supabase.rpc('reject_checklist_request', {
    p_request_id: requestId,
    p_admin_note: note || null,
  });
  if (error) throw error;
  await applyNoteVisibility(requestId, noteVisibleToDriver);
}
