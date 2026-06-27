import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import {
  acknowledgeMaintenanceItem,
  listMaintenanceItems,
  markMaintenanceItemCompleted,
  type MaintenanceItem,
} from '../lib/db/maintenance';

const STATUS_LABELS: Record<string, string> = {
  due: 'Due',
  pending: 'Pending',
  overdue: 'Overdue',
  passed: 'Passed',
  done: 'Done',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function MaintenanceScreen() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMaintenanceItems());
    } catch (err) {
      console.error('[Maintenance] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledge = async (item: MaintenanceItem) => {
    setBusyId(item.id);
    try {
      await acknowledgeMaintenanceItem(item.id);
      await load();
    } catch (err) {
      console.error('[Maintenance] acknowledge failed', err);
      Alert.alert('Error', 'Failed to acknowledge item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = (item: MaintenanceItem) => {
    Alert.alert('Mark Completed', `Mark "${item.service_type}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Completed',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await markMaintenanceItemCompleted(item.id);
            await load();
          } catch (err) {
            console.error('[Maintenance] complete failed', err);
            Alert.alert('Error', 'Failed to mark item completed.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer title="Maintenance" subtitle={`${items.length} items`}>
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No outstanding maintenance items.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{item.service_type}</Text>
                  <Text style={styles.status}>{STATUS_LABELS[item.status] ?? item.status}</Text>
                </View>
                <Text style={styles.date}>{new Date(item.service_date).toLocaleDateString()}</Text>
                <View style={styles.actions}>
                  {!item.acknowledged_at ? (
                    <TouchableOpacity
                      style={styles.actionButton}
                      disabled={busy}
                      onPress={() => handleAcknowledge(item)}
                    >
                      <Text style={styles.actionButtonText}>{busy ? '...' : 'Acknowledge'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.completeButton} disabled={busy} onPress={() => handleComplete(item)}>
                    <Text style={styles.actionButtonText}>{busy ? '...' : 'Mark Completed'}</Text>
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
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  status: { color: '#FF6B35', fontSize: 12, fontWeight: '600' },
  date: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { backgroundColor: '#262626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  completeButton: { backgroundColor: '#166534', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
