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
import { deleteDriverLog, listDriverLogs, type DriverLogRow } from '../lib/db/driverLogs';

const CATEGORY_COLORS: Record<string, string> = {
  incident: '#FB923C',
  maintenance: '#FBBF24',
  accident: '#F87171',
  general: '#60A5FA',
};

export default function LogsScreen() {
  const [logs, setLogs] = useState<DriverLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLogs(await listDriverLogs());
    } catch (err) {
      console.error('[Logs] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (row: DriverLogRow) => {
    Alert.alert('Delete Log', 'This will permanently delete this log. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await deleteDriverLog(row.id);
            await load();
          } catch (err) {
            console.error('[Logs] delete failed', err);
            Alert.alert('Error', 'Failed to delete log.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer title="Logs" subtitle={`${logs.length} recent`}>
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
                  <Text style={[styles.category, { color: CATEGORY_COLORS[item.category] }]}>
                    {item.category.toUpperCase()}
                  </Text>
                  <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.driver}>
                  {item.driver_name ?? 'Unknown driver'} · {item.vehicle_rego ?? 'No vehicle'}
                </Text>
                <Text style={styles.description}>{item.description}</Text>
                <View style={styles.actions}>
                  {item.photo_url ? (
                    <TouchableOpacity style={styles.actionButton} onPress={() => setPreviewUrl(item.photo_url)}>
                      <Text style={styles.actionButtonText}>View Photo</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.deleteButton} disabled={busy} onPress={() => handleDelete(item)}>
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
  category: { fontSize: 11, fontWeight: '700' },
  time: { color: '#9CA3AF', fontSize: 11 },
  driver: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginTop: 4 },
  description: { color: '#D1D5DB', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { backgroundColor: '#262626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  deleteButton: { backgroundColor: '#7F1D1D', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '90%', height: '80%' },
});
