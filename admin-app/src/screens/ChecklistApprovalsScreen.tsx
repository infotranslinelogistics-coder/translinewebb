import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import {
  approveChecklistRequest,
  listPendingChecklistApprovals,
  rejectChecklistRequest,
  type ChecklistApprovalRequest,
} from '../lib/db/checklistApprovals';

export default function ChecklistApprovalsScreen() {
  const [requests, setRequests] = useState<ChecklistApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await listPendingChecklistApprovals());
    } catch (err) {
      console.error('[ChecklistApprovals] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = (request: ChecklistApprovalRequest, approve: boolean) => {
    Alert.alert(
      approve ? 'Approve Request' : 'Reject Request',
      `${approve ? 'Approve' : 'Reject'} the checklist request for ${request.driver_name ?? 'this driver'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Reject',
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(request.request_id);
            try {
              if (approve) {
                await approveChecklistRequest(request.request_id, '');
              } else {
                await rejectChecklistRequest(request.request_id, '');
              }
              await load();
            } catch (err) {
              console.error('[ChecklistApprovals] decision failed', err);
              Alert.alert('Error', 'Failed to update the request.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer title="Checklist Approvals" subtitle={`${requests.length} pending`}>
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : requests.length === 0 ? (
        <Text style={styles.empty}>No pending checklist requests.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.request_id}
          renderItem={({ item }) => {
            const busy = busyId === item.request_id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.driver}>{item.driver_name ?? 'Unknown driver'}</Text>
                  <Text style={styles.time}>{new Date(item.requested_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.vehicle}>{item.vehicle_rego ?? 'No vehicle'}</Text>
                <Text style={styles.failedTitle}>Failed items ({item.failed_items_count})</Text>
                {item.failed_items.length === 0 ? (
                  <Text style={styles.empty}>No structured failed item list.</Text>
                ) : (
                  item.failed_items.map((failedItem) => (
                    <Text key={failedItem.key} style={styles.failedItem}>
                      • {failedItem.label}
                      {failedItem.critical ? ' (Critical)' : ''}
                      {failedItem.notes ? `: ${failedItem.notes}` : ''}
                    </Text>
                  ))
                )}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    disabled={busy}
                    onPress={() => handleDecision(item, true)}
                  >
                    <Text style={styles.actionButtonText}>{busy ? '...' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    disabled={busy}
                    onPress={() => handleDecision(item, false)}
                  >
                    <Text style={styles.actionButtonText}>{busy ? '...' : 'Reject'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
  empty: { color: '#9CA3AF', fontSize: 13, marginTop: 8 },
  card: {
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  driver: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  time: { color: '#9CA3AF', fontSize: 11 },
  vehicle: { color: '#FF6B35', fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  failedTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  failedItem: { color: '#D1D5DB', fontSize: 12, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveButton: { flex: 1, backgroundColor: '#166534', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  rejectButton: { flex: 1, backgroundColor: '#7F1D1D', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
