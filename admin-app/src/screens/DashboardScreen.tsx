import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { listDrivers } from '../lib/db/drivers';
import { listVehicles } from '../lib/db/vehicles';

export default function DashboardScreen() {
  const [driverCount, setDriverCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [drivers, vehicles] = await Promise.all([listDrivers(), listVehicles()]);
      setDriverCount(drivers.length);
      setOnlineCount(drivers.filter((d) => d.online_status === 'online').length);
      setVehicleCount(vehicles.length);
    } catch (err) {
      console.error('[Dashboard] load failed', err);
      setDriverCount(null);
      setOnlineCount(null);
      setVehicleCount(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = [
    { label: 'Drivers Online', value: onlineCount },
    { label: 'Total Drivers', value: driverCount },
    { label: 'Vehicles', value: vehicleCount },
  ];

  return (
    <ScreenContainer title="Dashboard" subtitle="Fleet overview">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
      >
        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.card}>
              <Text style={styles.cardValue}>{s.value ?? '—'}</Text>
              <Text style={styles.cardLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    width: '47%',
  },
  cardValue: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  cardLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
