import { supabase } from '../supabase';

export type ChecklistApprovalStatus = 'pending' | 'approved' | 'rejected' | string;

export type ChecklistFailedItem = {
  key: string;
  sectionTitle: string | null;
  label: string;
  notes: string | null;
  critical: boolean;
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
  raw_checklist: Record<string, unknown> | null;
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
        toText(entry.id) ??
        toText(entry.key) ??
        toText(entry.item_key) ??
        toText(entry.field) ??
        toText(entry.name) ??
        `failed_item_${index}`;

      const label =
        toText(entry.label) ??
        toText(entry.item_label) ??
        toText(entry.title) ??
        formatChecklistLabel(key);

      const sectionTitle =
        toText(entry.sectionTitle) ??
        toText(entry.section_title) ??
        toText(entry.section) ??
        null;

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

const parseChecklistFromRow = (row: Record<string, unknown>): Record<string, unknown> | null => {
  const direct =
    toRecord(row.checklist_payload) ??
    toRecord(row.checklist_snapshot) ??
    toRecord(row.checklist) ??
    toRecord(row.raw_checklist);

  if (direct) return direct;

  const metadata = toRecord(row.metadata);
  if (!metadata) return null;

  return (
    toRecord(metadata.checklist_payload) ??
    toRecord(metadata.checklist_snapshot) ??
    toRecord(metadata.checklist) ??
    toRecord(metadata.answers) ??
    null
  );
};

const mapApprovalRow = (
  row: Record<string, unknown>,
  driverNameById: Map<string, string>,
  regoByVehicleId: Map<string, string>
): ChecklistApprovalRequest => {
  const requestId =
    toText(row.request_id) ??
    toText(row.id) ??
    toText(row.approval_id) ??
    '';

  const driverId = toText(row.driver_id) ?? toText(row.requested_by_driver_id) ?? null;
  const vehicleId = toText(row.vehicle_id) ?? null;

  const failedItems = normalizeFailedItems(
    row.failed_items ?? toRecord(row.metadata)?.failed_items ?? []
  );

  const adminNote =
    toText(row.admin_note) ??
    toText(row.review_note) ??
    toText(row.note) ??
    toText(toRecord(row.metadata)?.admin_note) ??
    null;

  return {
    request_id: requestId,
    shift_id: toText(row.shift_id) ?? null,
    requested_at:
      toText(row.requested_at) ??
      toText(row.created_at) ??
      toText(row.requested_time) ??
      new Date().toISOString(),
    status: toText(row.status) ?? 'pending',
    driver_id: driverId,
    driver_name:
      toText(row.driver_name) ??
      (driverId ? driverNameById.get(driverId) ?? null : null) ??
      toText(toRecord(row.metadata)?.driver_name) ??
      null,
    vehicle_id: vehicleId,
    vehicle_rego:
      toText(row.vehicle_rego) ??
      toText(row.rego) ??
      (vehicleId ? regoByVehicleId.get(vehicleId) ?? null : null) ??
      toText(toRecord(row.metadata)?.vehicle_rego) ??
      null,
    failed_items_count: failedItems.length,
    failed_items: failedItems,
    admin_note: adminNote,
    note_visible_to_driver: row.note_visible_to_driver === true,
    raw_checklist: parseChecklistFromRow(row),
  };
};

async function listApprovalsRaw(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('checklist_approvals')
    .select('*')
    .order('requested_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

async function buildNameMaps(rows: Record<string, unknown>[]) {
  const driverIds = rows
    .map((row) => toText(row.driver_id) ?? toText(row.requested_by_driver_id))
    .filter((value): value is string => Boolean(value));

  const vehicleIds = rows
    .map((row) => toText(row.vehicle_id))
    .filter((value): value is string => Boolean(value));

  const [driversResponse, vehiclesResponse] = await Promise.all([
    driverIds.length > 0
      ? supabase
          .from('drivers')
          .select('id, full_name')
          .in('id', Array.from(new Set(driverIds)))
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase
          .from('vehicles')
          .select('id, rego')
          .in('id', Array.from(new Set(vehicleIds)))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResponse.error) throw driversResponse.error;
  if (vehiclesResponse.error) throw vehiclesResponse.error;

  const driverNameById = new Map<string, string>();
  ((driversResponse.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const id = toText(row.id);
    const fullName = toText(row.full_name);
    if (id && fullName) {
      driverNameById.set(id, fullName);
    }
  });

  const regoByVehicleId = new Map<string, string>();
  ((vehiclesResponse.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const id = toText(row.id);
    const rego = toText(row.rego);
    if (id && rego) {
      regoByVehicleId.set(id, rego);
    }
  });

  return { driverNameById, regoByVehicleId };
}

const isPendingStatus = (status: string | null | undefined) => {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'requested' || normalized === 'awaiting_approval';
};

export async function listChecklistApprovals(): Promise<ChecklistApprovalRequest[]> {
  const rows = await listApprovalsRaw();
  if (rows.length === 0) return [];

  const { driverNameById, regoByVehicleId } = await buildNameMaps(rows);

  return rows
    .map((row) => mapApprovalRow(row, driverNameById, regoByVehicleId))
    .filter((row) => row.request_id.length > 0)
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
}

export async function listPendingChecklistApprovals(): Promise<ChecklistApprovalRequest[]> {
  const rows = await listChecklistApprovals();
  return rows.filter((row) => isPendingStatus(row.status));
}

export async function countPendingChecklistApprovals(): Promise<number> {
  const rows = await listPendingChecklistApprovals();
  return rows.length;
}

/**
 * Sets whether the admin note on a request is shown to the driver in their app.
 * Backed by the set_checklist_note_visibility RPC (admin-only).
 */
export async function setChecklistNoteVisibility(
  requestId: string,
  visible: boolean
): Promise<void> {
  const { error } = await supabase.rpc('set_checklist_note_visibility', {
    p_request_id: requestId,
    p_visible: visible,
  });
  if (error) throw error;
}

// Applies note visibility without letting a missing migration break the core
// approve/reject action: if set_checklist_note_visibility isn't deployed yet the
// decision still goes through and we just log the visibility step as skipped.
async function applyNoteVisibility(requestId: string, visible: boolean): Promise<void> {
  try {
    await setChecklistNoteVisibility(requestId, visible);
  } catch (err) {
    console.warn('checklistApprovals: could not set note visibility (migration applied?):', err);
  }
}

export async function approveChecklistRequest(
  requestId: string,
  note: string,
  noteVisibleToDriver = false
): Promise<void> {
  const { error } = await supabase.rpc('approve_checklist_request', {
    p_request_id: requestId,
    p_admin_note: note ?? null,
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
    p_admin_note: note ?? null,
  });
  if (error) throw error;
  await applyNoteVisibility(requestId, noteVisibleToDriver);
}
