import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../components/ScreenContainer';
import { listDrivers, type Driver } from '../lib/db/drivers';
import type { DrawerParamList } from '../types/navigation';

export default function DriversScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DrawerParamList, 'Drivers'>>();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setDrivers(await listDrivers());
    } catch (err) {
      console.error('[Drivers] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = drivers.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.full_name?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    );
  });

  return (
    <ScreenContainer title="Drivers" subtitle={`${drivers.length} total`}>
      <TextInput
        style={styles.search}
        placeholder="Search drivers..."
        placeholderTextColor="#6B7280"
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.driver_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('DriverProfile', { driverId: item.driver_id })}
            >
              <View style={[styles.statusDot, item.online_status === 'online' && styles.statusDotOnline]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.full_name ?? item.email ?? item.driver_id}</Text>
                <Text style={styles.rowSubtitle}>{item.email ?? 'No email'}</Text>
              </View>
              {item.current_vehicle_rego ? (
                <Text style={styles.rego}>{item.current_vehicle_rego}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    marginBottom: 12,
  },
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
  statusDotOnline: { backgroundColor: '#22C55E' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  rego: { color: '#FF6B35', fontSize: 12, fontWeight: '600' },
});
