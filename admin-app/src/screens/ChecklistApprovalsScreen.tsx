import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, ModalSheet, Loader, Empty, COLORS } from '../components/ui';
import {
  listChecklistApprovals,
  approveChecklistRequest,
  rejectChecklistRequest,
  type ChecklistApprovalRequest,
} from '../lib/db/checklistApprovals';
import { formatPerthDateTime } from '../lib/dateTime';

function statusVariant(status: string): 'green' | 'red' | 'yellow' {
  const s = status.toLowerCase();
  if (s === 'approved') return 'green';
  if (s === 'rejected') return 'red';
  return 'yellow';
}
function isPending(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'pending' || s === 'requested' || s === 'awaiting_approval';
}

export default function ChecklistApprovalsScreen() {
  const [requests, setRequests] = useState<ChecklistApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteVisible, setNoteVisible] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<ChecklistApprovalRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await listChecklistApprovals());
      setError(null);
    } catch (err) {
      console.error('[ChecklistApprovals] load failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const stats = useMemo(
    () => ({
      pending: requests.filter((r) => isPending(r.status)).length,
      approved: requests.filter((r) => r.status.toLowerCase() === 'approved').length,
      rejected: requests.filter((r) => r.status.toLowerCase() === 'rejected').length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.driver_name, r.driver_id, r.vehicle_rego, r.vehicle_id, r.status, r.admin_note, r.failed_items.map((f) => f.label).join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [requests, search]);

  const handleApprove = async (req: ChecklistApprovalRequest) => {
    setBusyId(req.request_id);
    setError(null);
    try {
      await approveChecklistRequest(req.request_id, notes[req.request_id] ?? '', noteVisible[req.request_id] ?? false);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: ChecklistApprovalRequest) => {
    const note = (notes[req.request_id] ?? '').trim();
    if (!note) {
      setError('Reject note is required.');
      return;
    }
    setBusyId(req.request_id);
    setError(null);
    try {
      await rejectChecklistRequest(req.request_id, note, noteVisible[req.request_id] ?? false);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenContainer title="Checklist Approvals" subtitle="Failed pre-start checklists awaiting review">
      <View style={styles.statRow}>
        <StatCard label="Pending" value={stats.pending} color={COLORS.red} />
        <StatCard label="Approved" value={stats.approved} color={COLORS.green} />
        <StatCard label="Rejected" value={stats.rejected} color={COLORS.yellow} />
      </View>

      <View style={styles.toolbar}>
        <Field placeholder="Search…" value={search} onChangeText={setSearch} style={{ flex: 1, marginBottom: 0 }} />
        <Btn label="Refresh" small variant="secondary" onPress={load} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <Loader />
      ) : (
        <ScrollView>
          {filtered.length === 0 ? (
            <Empty text="No checklist approval requests found." />
          ) : (
            filtered.map((req) => {
              const pending = isPending(req.status);
              const busy = busyId === req.request_id;
              return (
                <Card key={req.request_id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.driver}>{req.driver_name ?? 'Unknown driver'}</Text>
                    <Badge label={req.status} variant={statusVariant(req.status)} />
                  </View>
                  <Text style={styles.sub}>
                    {req.vehicle_rego ?? 'No vehicle'} · {formatPerthDateTime(req.requested_at)}
                  </Text>
                  <Text style={styles.failed}>Failed items: {req.failed_items_count}</Text>
                  {req.failed_items.slice(0, 3).map((f) => (
                    <Text key={f.key} style={styles.failedItem}>
                      • {f.label}
                      {f.sectionTitle ? ` [${f.sectionTitle}]` : ''}
                      {f.critical ? ' (Critical)' : ''}
                      {f.notes ? `: ${f.notes}` : ''}
                    </Text>
                  ))}

                  <Btn label="View Checklist" small variant="secondary" style={{ marginTop: 8 }} onPress={() => setViewing(req)} />

                  {pending ? (
                    <View style={{ marginTop: 10 }}>
                      <Field
                        placeholder="Admin note (required to reject)"
                        value={notes[req.request_id] ?? ''}
                        onChangeText={(t) => setNotes((p) => ({ ...p, [req.request_id]: t }))}
                        multiline
                      />
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Show this note to the driver</Text>
                        <Switch
                          value={noteVisible[req.request_id] ?? false}
                          onValueChange={(v) => setNoteVisible((p) => ({ ...p, [req.request_id]: v }))}
                          trackColor={{ true: COLORS.accent, false: COLORS.border }}
                        />
                      </View>
                      <View style={styles.actions}>
                        <Btn label={busy ? '…' : 'Approve'} small variant="success" disabled={busy} onPress={() => handleApprove(req)} />
                        <Btn label={busy ? '…' : 'Reject'} small variant="danger" disabled={busy} onPress={() => handleReject(req)} />
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <Text style={styles.adminNote}>{req.admin_note ? `Note: ${req.admin_note}` : 'Request finalized.'}</Text>
                      {req.note_visible_to_driver ? <Badge label="Visible to driver" variant="green" /> : null}
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      <ModalSheet visible={Boolean(viewing)} onClose={() => setViewing(null)} title="Checklist">
        {viewing ? (
          <View>
            <Text style={styles.modalMeta}>Driver: {viewing.driver_name ?? '—'}</Text>
            <Text style={styles.modalMeta}>Vehicle: {viewing.vehicle_rego ?? '—'}</Text>
            <Text style={styles.modalMeta}>Requested: {formatPerthDateTime(viewing.requested_at)}</Text>
            <Text style={styles.modalMeta}>Status: {viewing.status}</Text>

            <Text style={styles.modalHeading}>Failed Items ({viewing.failed_items.length})</Text>
            {viewing.failed_items.length === 0 ? (
              <Empty text="No structured failed item list." />
            ) : (
              viewing.failed_items.map((f) => (
                <Text key={f.key} style={styles.failedItem}>
                  • {f.label}
                  {f.sectionTitle ? ` [${f.sectionTitle}]` : ''}
                  {f.critical ? ' (Critical)' : ''}
                  {f.notes ? `: ${f.notes}` : ''}
                </Text>
              ))
            )}

            <Text style={styles.modalHeading}>Full Checklist ({viewing.raw_checklist.length})</Text>
            {viewing.raw_checklist.length === 0 ? (
              <Empty text="No checklist snapshot was saved." />
            ) : (
              viewing.raw_checklist.map((entry) => (
                <View key={entry.key} style={styles.checkRow}>
                  <Text style={styles.checkLabel}>{entry.label}</Text>
                  <Badge label={entry.status} variant={entry.status === 'fail' ? 'red' : entry.status === 'pass' ? 'green' : 'yellow'} />
                </View>
              ))
            )}

            {viewing.admin_note ? (
              <>
                <Text style={styles.modalHeading}>Admin Note</Text>
                <Text style={styles.modalMeta}>{viewing.admin_note}</Text>
              </>
            ) : null}
            <Btn label="Close" variant="ghost" onPress={() => setViewing(null)} />
          </View>
        ) : null}
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  driver: { color: COLORS.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  sub: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
  failed: { color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 8 },
  failedItem: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  switchLabel: { color: COLORS.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  adminNote: { color: COLORS.muted, fontSize: 12 },
  modalMeta: { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
  modalHeading: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 10 },
  checkLabel: { color: COLORS.text, fontSize: 13, flexShrink: 1 },
});
