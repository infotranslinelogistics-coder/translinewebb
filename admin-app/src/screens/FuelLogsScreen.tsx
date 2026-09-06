import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, KV, Loader, Empty, COLORS } from '../components/ui';
import {
  deleteFuelLog,
  listFuelLogs,
  toggleFuelLogReviewed,
  getFuelWeeklySummary,
  type FuelLogRow,
  type FuelWeeklySummary,
} from '../lib/db/fuelLogs';
import { formatPerthDateTime } from '../lib/dateTime';

export default function FuelLogsScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<FuelLogRow[]>([]);
  const [summary, setSummary] = useState<FuelWeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([listFuelLogs(), getFuelWeeklySummary().catch(() => null)]);
      setLogs(l);
      setSummary(s);
    } catch (err) {
      console.error('[FuelLogs] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (row: FuelLogRow) => {
    setBusyId(row.id);
    try {
      await toggleFuelLogReviewed(row);
      await load();
    } catch (err) {
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
            Alert.alert('Error', 'Failed to delete fuel log.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer title="Fuel Logs" subtitle="Fuel purchases recorded from shift events">
      {loading ? (
        <Loader />
      ) : (
        <ScrollView>
          <View style={styles.statRow}>
            <StatCard label="Weekly Logs" value={summary?.totalFuelLogs ?? 0} />
            <StatCard label="Weekly Litres" value={`${(summary?.totalLitres ?? 0).toFixed(1)} L`} color={COLORS.blue} />
            <StatCard label="Weekly Cost" value={`$${(summary?.totalCost ?? 0).toFixed(2)}`} color={COLORS.green} />
            <StatCard label="Avg / Litre" value={summary?.avgPerLitre != null ? `$${summary.avgPerLitre.toFixed(2)}` : '—'} color={COLORS.accent} />
          </View>

          {logs.length === 0 ? (
            <Empty text="No fuel logs found." />
          ) : (
            logs.map((item) => {
              const busy = busyId === item.id;
              return (
                <Card key={item.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.driver}>{item.driver_name ?? 'Unknown driver'}</Text>
                    <Text style={styles.time}>{formatPerthDateTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.vehicle}>{item.vehicle_rego ?? 'No vehicle'}</Text>
                  <KV k="Litres" v={item.litres != null ? `${item.litres.toFixed(2)} L` : '—'} />
                  <KV k="Cost" v={item.cost != null ? `$${item.cost.toFixed(2)}` : '—'} />
                  <KV k="Odometer" v={item.odometer_km != null ? `${item.odometer_km.toLocaleString()} km` : '—'} />
                  <KV k="Station" v={item.station_name ?? '—'} />
                  {item.latitude != null && item.longitude != null ? (
                    <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                      <Text style={styles.mapLink}>📍 Open in Maps</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.actions}>
                    {item.receipt_url ? <Btn label="View Receipt" small variant="secondary" onPress={() => setPreview(item.receipt_url)} /> : null}
                    {item.shift_id ? <Btn label="View Shift" small variant="secondary" onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.shift_id })} /> : null}
                    <Btn label={item.reviewed ? 'Mark Unseen' : 'Mark Seen'} small variant="secondary" disabled={busy} onPress={() => handleToggle(item)} />
                    <Btn label={busy ? '…' : 'Delete'} small variant="danger" disabled={busy} onPress={() => handleDelete(item)} />
                  </View>
                  {item.reviewed ? <View style={{ marginTop: 6 }}><Badge label="Seen" variant="green" /></View> : null}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driver: { color: COLORS.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  time: { color: COLORS.muted, fontSize: 11 },
  vehicle: { color: COLORS.accent, fontSize: 12, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  mapLink: { color: COLORS.blue, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '92%', height: '80%' },
});
