import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../components/ScreenContainer';
import { fetchShiftsFull, type ShiftFull } from '../lib/db/shifts';
import type { DrawerParamList } from '../types/navigation';

export default function ShiftsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DrawerParamList, 'Shifts'>>();
  const [shifts, setShifts] = useState<ShiftFull[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScreenContainer title="Shifts" subtitle={`${shifts.length} recent`}>
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.id })}
            >
              <View style={[styles.statusDot, item.status === 'active' && styles.statusDotActive]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.driver_name ?? item.driver_id ?? 'Unknown driver'}</Text>
                <Text style={styles.rowSubtitle}>{item.vehicle_rego ?? 'No vehicle'}</Text>
              </View>
              <Text style={styles.status}>{item.status ?? '—'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4B5563', marginRight: 10 },
  statusDotActive: { backgroundColor: '#22C55E' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  status: { color: '#FF6B35', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
