import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { deleteFuelLog, listFuelLogs, toggleFuelLogReviewed, type FuelLogRow } from '../lib/db/fuelLogs';

export default function FuelLogsScreen() {
  const [logs, setLogs] = useState<FuelLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLogs(await listFuelLogs());
    } catch (err) {
      console.error('[FuelLogs] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleReviewed = async (row: FuelLogRow) => {
    setBusyId(row.id);
    try {
      await toggleFuelLogReviewed(row);
      await load();
    } catch (err) {
      console.error('[FuelLogs] toggle reviewed failed', err);
      Alert.alert('Error', 'Failed to update fuel log.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (row: FuelLogRow) => {
    Alert.alert('Delete Fuel Log', 'This will permanently delete this fuel log. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await deleteFuelLog(row.id);
            await load();
          } catch (err) {
            console.error('[FuelLogs] delete failed', err);
            Alert.alert('Error', 'Failed to delete fuel log.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer title="Fuel Logs" subtitle={`${logs.length} recent`}>
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.driver}>{item.driver_name ?? 'Unknown driver'}</Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.vehicle}>{item.vehicle_rego ?? 'No vehicle'}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Litres</Text>
                  <Text style={styles.detailValue}>{item.litres != null ? `${item.litres.toFixed(2)} L` : '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cost</Text>
                  <Text style={styles.detailValue}>{item.cost != null ? `$${item.cost.toFixed(2)}` : '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Station</Text>
                  <Text style={styles.detailValue}>{item.station_name ?? '—'}</Text>
                </View>
                <View style={styles.actions}>
                  {item.receipt_url ? (
                    <TouchableOpacity style={styles.actionButton} onPress={() => setPreviewUrl(item.receipt_url)}>
                      <Text style={styles.actionButtonText}>View Receipt</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.actionButton}
                    disabled={busy}
                    onPress={() => handleToggleReviewed(item)}
                  >
                    <Text style={styles.actionButtonText}>{item.reviewed ? 'Mark Unseen' : 'Mark Seen'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    disabled={busy}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.actionButtonText}>{busy ? '...' : 'Delete'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={Boolean(previewUrl)} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { color: '#9CA3AF', fontSize: 12 },
  detailValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionButton: { backgroundColor: '#262626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButton: { backgroundColor: '#7F1D1D', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '90%', height: '80%' },
});
