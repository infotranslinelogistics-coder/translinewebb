import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, Loader, Empty, COLORS } from '../components/ui';
import { deleteDriverLog, listDriverLogs, type DriverLogRow, type DriverLogCategory } from '../lib/db/driverLogs';
import { formatPerthDateTime } from '../lib/dateTime';

const CATEGORY_VARIANT: Record<DriverLogCategory, 'yellow' | 'red' | 'blue' | 'accent'> = {
  incident: 'accent',
  maintenance: 'yellow',
  accident: 'red',
  general: 'blue',
};

type Filter = 'all' | DriverLogCategory;

function severityVariant(s: string): 'red' | 'yellow' | 'gray' {
  const v = s.toLowerCase();
  if (v === 'high') return 'red';
  if (v === 'medium') return 'yellow';
  return 'gray';
}

export default function LogsScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<DriverLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<string | null>(null);
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

  const stats = useMemo(
    () => ({
      total: logs.length,
      incident: logs.filter((l) => l.category === 'incident').length,
      maintenance: logs.filter((l) => l.category === 'maintenance').length,
      accident: logs.filter((l) => l.category === 'accident').length,
    }),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter !== 'all' && l.category !== filter) return false;
      if (!q) return true;
      return [l.description, l.driver_name, l.vehicle_rego].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [logs, search, filter]);

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
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete log.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['incident', 'Incidents'],
    ['maintenance', 'Maintenance'],
    ['accident', 'Accidents'],
    ['general', 'General'],
  ];

  return (
    <ScreenContainer title="Logs" subtitle="Driver-reported logs">
      <View style={styles.statRow}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Incidents" value={stats.incident} color={COLORS.accent} />
        <StatCard label="Maintenance" value={stats.maintenance} color={COLORS.yellow} />
        <StatCard label="Accidents" value={stats.accident} color={COLORS.red} />
      </View>

      <Field placeholder="Search logs..." value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {filters.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, filter === key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <Loader />
      ) : (
        <ScrollView>
          {filtered.length === 0 ? (
            <Empty text="No logs found." />
          ) : (
            filtered.map((item) => {
              const busy = busyId === item.id;
              return (
                <Card key={item.id}>
                  <View style={styles.rowBetween}>
                    <Badge label={item.category.toUpperCase()} variant={CATEGORY_VARIANT[item.category]} />
                    <Text style={styles.time}>{formatPerthDateTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.driver}>
                    {item.driver_name ?? 'Unknown driver'} · {item.vehicle_rego ?? 'No vehicle'}
                  </Text>
                  <Text style={styles.desc}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <Badge label={`Severity: ${item.severity}`} variant={severityVariant(item.severity)} />
                    {item.latitude != null && item.longitude != null ? (
                      <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${item.latitude},${item.longitude}`)}>
                        <Text style={styles.mapLink}>📍 {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.actions}>
                    {item.photo_url ? <Btn label="View Photo" small variant="secondary" onPress={() => setPreview(item.photo_url)} /> : null}
                    {item.shift_id ? <Btn label="Shift Details" small variant="secondary" onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.shift_id! })} /> : null}
                    <Btn label={busy ? '…' : 'Delete'} small variant="danger" disabled={busy} onPress={() => handleDelete(item)} />
                  </View>
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
  filterScroll: { maxHeight: 44, marginBottom: 8 },
  filterRow: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, height: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  time: { color: COLORS.muted, fontSize: 11 },
  driver: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  desc: { color: COLORS.muted, fontSize: 12, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  mapLink: { color: COLORS.blue, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '92%', height: '80%' },
});
