import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, ModalSheet, Loader, Empty, COLORS } from '../components/ui';
import { supabase } from '../lib/supabase';
import { fetchShiftsFull, forceEndShift, deleteShiftAdmin, type ShiftFull } from '../lib/db/shifts';
import { formatPerthDateTime } from '../lib/dateTime';

type StatusFilter = 'all' | 'active' | 'ended';

function isActive(s: ShiftFull): boolean {
  return !s.ended_at || s.status === 'active';
}

export default function ShiftsScreen() {
  const navigation = useNavigation<any>();
  const [shifts, setShifts] = useState<ShiftFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [manage, setManage] = useState<ShiftFull | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setShifts(await fetchShiftsFull());
    } catch (err) {
      console.error('[Shifts] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-shifts-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      active: shifts.filter(isActive).length,
      today: shifts.filter((s) => s.started_at && new Date(s.started_at).getTime() >= today.getTime()).length,
      total: shifts.length,
    };
  }, [shifts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      if (statusFilter === 'active' && !isActive(s)) return false;
      if (statusFilter === 'ended' && isActive(s)) return false;
      if (!q) return true;
      return (
        s.driver_name?.toLowerCase().includes(q) ||
        s.vehicle_rego?.toLowerCase().includes(q) ||
        s.driver_id?.toLowerCase().includes(q) ||
        s.vehicle_id?.toLowerCase().includes(q)
      );
    });
  }, [shifts, search, statusFilter]);

  const handleForceEnd = (shift: ShiftFull) => {
    Alert.alert('End Shift', 'Force-end this active shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Shift',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await forceEndShift(shift.id);
            setManage(null);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to end shift.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = (shift: ShiftFull) => {
    Alert.alert('Delete Shift', 'This deletes the shift and all related events. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteShiftAdmin(shift.id);
            setManage(null);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete shift.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const filters: [StatusFilter, string][] = [
    ['all', 'All'],
    ['active', 'Active'],
    ['ended', 'Ended'],
  ];

  return (
    <ScreenContainer title="Shifts" subtitle="Track driver shifts and checklists">
      <View style={styles.statRow}>
        <StatCard label="Active Shifts" value={stats.active} color={COLORS.green} />
        <StatCard label="Today's Shifts" value={stats.today} />
        <StatCard label="Total Shifts" value={stats.total} color={COLORS.blue} />
      </View>

      <Field placeholder="Search shifts..." value={search} onChangeText={setSearch} />
      <View style={styles.filterRow}>
        {filters.map(([key, label]) => (
          <Pressable key={key} onPress={() => setStatusFilter(key)} style={[styles.filterBtn, statusFilter === key && styles.filterActive]}>
            <Text style={[styles.filterText, statusFilter === key && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="No shifts found." />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.driver_name ?? item.driver_id ?? 'Unknown driver'}</Text>
                <Text style={styles.sub}>{item.vehicle_rego ?? 'No vehicle'}</Text>
                <Text style={styles.time}>Start: {formatPerthDateTime(item.started_at)}</Text>
                <Text style={styles.time}>End: {item.ended_at ? formatPerthDateTime(item.ended_at) : 'In progress'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {isActive(item) ? <Badge label="Active" variant="green" /> : <Badge label={item.status ?? 'ended'} variant="gray" />}
                <Btn label="Manage" small variant="secondary" onPress={() => setManage(item)} />
              </View>
            </Pressable>
          )}
        />
      )}

      <ModalSheet visible={Boolean(manage)} onClose={() => setManage(null)} title={manage?.driver_name ?? 'Shift'}>
        <Btn label="View Details" variant="secondary" onPress={() => { const s = manage; setManage(null); if (s) navigation.navigate('ShiftDetail', { shiftId: s.id }); }} />
        {manage && isActive(manage) ? (
          <Btn label={busy ? '…' : 'Force End Shift'} variant="danger" style={{ marginTop: 8 }} disabled={busy} onPress={() => manage && handleForceEnd(manage)} />
        ) : null}
        <Btn label={busy ? '…' : 'Delete Shift'} variant="danger" style={{ marginTop: 8 }} disabled={busy} onPress={() => manage && handleDelete(manage)} />
        <Btn label="Close" variant="ghost" onPress={() => setManage(null)} />
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  sub: { color: COLORS.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  time: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
});
