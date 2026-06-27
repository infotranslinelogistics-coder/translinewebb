import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import type { DrawerParamList } from '../types/navigation';

export default function VehicleProfileScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'VehicleProfile'>>();
  const { vehicleId } = route.params;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listVehicles()
      .then((vehicles) => {
        if (!cancelled) setVehicle(vehicles.find((v) => v.id === vehicleId) ?? null);
      })
      .catch((err) => console.error('[VehicleProfile] load failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (loading) {
    return (
      <ScreenContainer title="Vehicle">
        <ActivityIndicator color="#FF6B35" />
      </ScreenContainer>
    );
  }

  if (!vehicle) {
    return (
      <ScreenContainer title="Vehicle">
        <Text style={styles.value}>Vehicle not found.</Text>
      </ScreenContainer>
    );
  }

  const rows: Array<[string, string]> = [
    ['Make', vehicle.make ?? '—'],
    ['Model', vehicle.model ?? '—'],
    ['Status', vehicle.status ?? '—'],
    ['Assigned driver', vehicle.driver_name ?? 'Unassigned'],
  ];

  return (
    <ScreenContainer title={vehicle.rego}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: '#262626',
    borderBottomWidth: 1,
  },
  label: { color: '#9CA3AF', fontSize: 13 },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
