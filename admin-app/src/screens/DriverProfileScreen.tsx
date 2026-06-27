import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { getDriver, type Driver } from '../lib/db/drivers';
import type { DrawerParamList } from '../types/navigation';

export default function DriverProfileScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'DriverProfile'>>();
  const { driverId } = route.params;
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDriver(driverId)
      .then((d) => {
        if (!cancelled) setDriver(d);
      })
      .catch((err) => console.error('[DriverProfile] load failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  if (loading) {
    return (
      <ScreenContainer title="Driver">
        <ActivityIndicator color="#FF6B35" />
      </ScreenContainer>
    );
  }

  if (!driver) {
    return (
      <ScreenContainer title="Driver">
        <Text style={styles.value}>Driver not found.</Text>
      </ScreenContainer>
    );
  }

  const rows: Array<[string, string]> = [
    ['Email', driver.email ?? '—'],
    ['Phone number', driver.phone ?? '—'],
    ['Status', driver.status ?? '—'],
    ['Online status', driver.online_status ?? '—'],
  ];

  return (
    <ScreenContainer title={driver.full_name ?? 'Driver'}>
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
