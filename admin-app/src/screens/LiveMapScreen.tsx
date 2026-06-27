import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import ScreenContainer from '../components/ScreenContainer';
import { listDriverCurrentStatus, type DriverCurrentStatus } from '../lib/db/liveStatus';

const DEFAULT_REGION = {
  latitude: -33.8688,
  longitude: 151.2093,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export default function LiveMapScreen() {
  const [statuses, setStatuses] = useState<DriverCurrentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setStatuses(await listDriverCurrentStatus());
    } catch (err) {
      console.error('[LiveMap] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const pins = statuses.filter((s) => s.lat != null && s.lng != null);

  if (loading) {
    return (
      <ScreenContainer title="Live Map">
        <ActivityIndicator color="#FF6B35" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Live Map" subtitle={`${pins.length} drivers with location`}>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION}>
          {pins.map((s) => (
            <Marker
              key={s.driver_id}
              coordinate={{ latitude: s.lat as number, longitude: s.lng as number }}
              title={s.driver_id}
              description={s.status_state ?? undefined}
              pinColor={s.is_online ? '#22C55E' : '#4B5563'}
            />
          ))}
        </MapView>
      </View>
      {pins.length === 0 ? <Text style={styles.empty}>No driver locations available.</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  empty: { color: '#9CA3AF', fontSize: 13, marginTop: 12 },
});
