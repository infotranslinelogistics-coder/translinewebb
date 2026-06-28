import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import MapWebView, { type MapMarker, type MapRoute } from '../components/MapWebView';
import { Card, Badge, Btn, Loader, Empty, COLORS } from '../components/ui';
import { listDriverCurrentStatus, type DriverCurrentStatus } from '../lib/db/liveStatus';
import { listLatestLocationsByDrivers, subscribeToLocationUpdates, type DriverLocation } from '../lib/db/locations';
import { fetchShiftsFull, type ShiftFull } from '../lib/db/shifts';
import { listDrivers, type Driver } from '../lib/db/drivers';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import { formatPerthDateTime } from '../lib/dateTime';

const ONLINE = '#2f659e';
const OFFLINE = '#c7c7c7';

export default function LiveMapScreen() {
  const navigation = useNavigation<any>();
  const [statuses, setStatuses] = useState<DriverCurrentStatus[]>([]);
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({});
  const [shifts, setShifts] = useState<ShiftFull[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [st, sh, d, v] = await Promise.all([
        listDriverCurrentStatus().catch(() => [] as DriverCurrentStatus[]),
        fetchShiftsFull().catch(() => [] as ShiftFull[]),
        listDrivers().catch(() => [] as Driver[]),
        listVehicles().catch(() => [] as Vehicle[]),
      ]);
      setStatuses(st);
      setShifts(sh);
      setDrivers(d);
      setVehicles(v);

      const activeDriverIds = sh.filter((s) => !s.ended_at && s.driver_id).map((s) => s.driver_id as string);
      if (activeDriverIds.length) {
        const locs = await listLatestLocationsByDrivers(activeDriverIds).catch(() => [] as DriverLocation[]);
        setLocations(Object.fromEntries(locs.map((l) => [l.driver_id, l])));
      }
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

  // realtime location updates
  useEffect(() => {
    const channel = subscribeToLocationUpdates((row) => {
      setLocations((prev) => ({ ...prev, [row.driver_id]: row }));
    });
    return () => {
      void channel.unsubscribe();
    };
  }, []);

  const driverName = useCallback(
    (id: string | null | undefined) => (id ? drivers.find((d) => d.driver_id === id)?.full_name ?? id.slice(0, 8) : 'Unknown'),
    [drivers]
  );
  const onlineByDriver = useMemo(() => {
    const map = new Map<string, boolean>();
    drivers.forEach((d) => map.set(d.driver_id, d.online_status === 'online'));
    statuses.forEach((s) => {
      if (s.is_online != null) map.set(s.driver_id, Boolean(s.is_online));
    });
    return map;
  }, [drivers, statuses]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => !s.ended_at && (vehicleFilter === 'all' || s.vehicle_id === vehicleFilter)),
    [shifts, vehicleFilter]
  );

  const selectedShift = useMemo(() => shifts.find((s) => s.id === selectedShiftId) ?? null, [shifts, selectedShiftId]);

  const pins = useMemo((): MapMarker[] => {
    return statuses
      .filter((s) => s.lat != null && s.lng != null)
      .filter((s) => (vehicleFilter === 'all' ? true : s.vehicle_id === vehicleFilter))
      .map((s) => ({
        lat: s.lat as number,
        lng: s.lng as number,
        color: onlineByDriver.get(s.driver_id) ? ONLINE : OFFLINE,
        radius: 8,
        label: `${driverName(s.driver_id)}${s.status_state ? ' — ' + s.status_state : ''}`,
      }));
  }, [statuses, vehicleFilter, onlineByDriver, driverName]);

  const selectedRoute = useMemo((): MapRoute | null => {
    if (!selectedShift) return null;
    const startLat = selectedShift.start_lat;
    const startLng = selectedShift.start_lng;
    const liveLoc = selectedShift.driver_id ? locations[selectedShift.driver_id] : undefined;
    const endLat = selectedShift.end_lat ?? liveLoc?.latitude ?? null;
    const endLng = selectedShift.end_lng ?? liveLoc?.longitude ?? null;
    if (startLat != null && startLng != null && endLat != null && endLng != null) {
      return { startLat, startLng, endLat, endLng, completed: Boolean(selectedShift.ended_at) };
    }
    return null;
  }, [selectedShift, locations]);

  if (loading) {
    return (
      <ScreenContainer title="Live Map">
        <Loader />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Live Map" subtitle="Real-time driver and vehicle tracking">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        <Chip label="All vehicles" active={vehicleFilter === 'all'} onPress={() => setVehicleFilter('all')} />
        {vehicles.map((v) => (
          <Chip key={v.id} label={v.rego} active={vehicleFilter === v.id} onPress={() => setVehicleFilter(v.id)} />
        ))}
      </ScrollView>

      <View style={styles.mapWrap}>
        <MapWebView tiles="osm" markers={selectedRoute ? [] : pins} route={selectedRoute} />
      </View>

      {selectedShift ? (
        <Btn label="Show all drivers" small variant="secondary" style={{ marginVertical: 8 }} onPress={() => setSelectedShiftId(null)} />
      ) : (
        <Text style={styles.hint}>{pins.length} driver location(s). Tap an active shift to draw its route.</Text>
      )}

      <Text style={styles.heading}>Active Shifts ({activeShifts.length})</Text>
      <ScrollView style={{ flex: 1 }}>
        {activeShifts.length === 0 ? (
          <Empty text="No active shifts available." />
        ) : (
          activeShifts.map((s) => {
            const online = s.driver_id ? onlineByDriver.get(s.driver_id) : false;
            const loc = s.driver_id ? locations[s.driver_id] : undefined;
            const selected = s.id === selectedShiftId;
            return (
              <Pressable key={s.id} onPress={() => setSelectedShiftId(selected ? null : s.id)}>
                <Card style={selected ? { borderColor: COLORS.accent } : undefined}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.driver}>{s.driver_name ?? driverName(s.driver_id)}</Text>
                    {online ? <Badge label="Online" variant="green" /> : <Badge label="Offline" variant="yellow" />}
                  </View>
                  <Text style={styles.sub}>Vehicle: {s.vehicle_rego ?? '—'}</Text>
                  {loc ? (
                    <Text style={styles.coord}>
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} · {formatPerthDateTime(loc.created_at)}
                    </Text>
                  ) : (
                    <Text style={styles.coord}>No live location</Text>
                  )}
                  <View style={styles.actions}>
                    <Btn label={selected ? 'Hide Route' : 'Draw Route'} small onPress={() => setSelectedShiftId(selected ? null : s.id)} />
                    <Btn label="Shift Details" small variant="secondary" onPress={() => navigation.navigate('ShiftDetail', { shiftId: s.id })} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterScroll: { maxHeight: 44, marginBottom: 8 },
  filterRow: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, height: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  mapWrap: { height: 280, borderRadius: 12, overflow: 'hidden' },
  hint: { color: COLORS.muted, fontSize: 12, marginVertical: 8 },
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  driver: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  sub: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
  coord: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
