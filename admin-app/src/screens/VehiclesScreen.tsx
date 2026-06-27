import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenContainer from '../components/ScreenContainer';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import type { DrawerParamList } from '../types/navigation';

export default function VehiclesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DrawerParamList, 'Vehicles'>>();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setVehicles(await listVehicles());
    } catch (err) {
      console.error('[Vehicles] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = vehicles.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.rego.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.driver_name?.toLowerCase().includes(q)
    );
  });

  return (
    <ScreenContainer title="Vehicles" subtitle={`${vehicles.length} total`}>
      <TextInput
        style={styles.search}
        placeholder="Search vehicles..."
        placeholderTextColor="#6B7280"
        value={search}
        onChangeText={setSearch}
      />
      {loading ? (
        <ActivityIndicator color="#FF6B35" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('VehicleProfile', { vehicleId: item.id })}
            >
              <View style={[styles.statusDot, item.status === 'active' && styles.statusDotActive]} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.rego}</Text>
                <Text style={styles.rowSubtitle}>
                  {[item.make, item.model].filter(Boolean).join(' ') || 'Unknown vehicle'}
                </Text>
              </View>
              <Text style={styles.driver}>{item.driver_name ?? 'Unassigned'}</Text>
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
  statusDotActive: { backgroundColor: '#22C55E' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  driver: { color: '#FF6B35', fontSize: 12, fontWeight: '600' },
});
