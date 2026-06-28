import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import MapWebView from '../components/MapWebView';
import { Card, StatCard, Badge, Btn, KV, Pager, Loader, Empty, COLORS } from '../components/ui';
import type { DrawerParamList } from '../types/navigation';
import { getVehicle, type Vehicle } from '../lib/db/vehicles';
import { fetchShiftsFull, fetchShiftsFullByVehicle, type ShiftFull } from '../lib/db/shifts';
import { getLatestOdometerForVehicle, getFirstOdometerForVehicle, listOdometerByVehicle, type OdometerReading } from '../lib/db/odometer';
import { listMaintenanceByVehicle, normalizeMaintenanceStatus, type MaintenanceItem } from '../lib/db/maintenance';
import { getDriverCurrentStatus, subscribeDriverGps, type DriverCurrentStatus } from '../lib/db/liveStatus';
import { listLatestLocationsByDrivers, type DriverLocation } from '../lib/db/locations';
import { formatPerthDateTime } from '../lib/dateTime';

type Tab = 'overview' | 'shifts' | 'odometer' | 'maintenance';
const PAGE = 10;

function startOfWeekMonday(): number {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export default function VehicleProfileScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'VehicleProfile'>>();
  const navigation = useNavigation<any>();
  const { vehicleId } = route.params;

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [latestOdo, setLatestOdo] = useState<OdometerReading | null>(null);
  const [firstOdo, setFirstOdo] = useState<OdometerReading | null>(null);
  const [weekShifts, setWeekShifts] = useState<ShiftFull[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftFull | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverCurrentStatus | null>(null);
  const [location, setLocation] = useState<DriverLocation | null>(null);

  const [shiftPage, setShiftPage] = useState(1);
  const [odoPage, setOdoPage] = useState(1);
  const [maintPage, setMaintPage] = useState(1);
  const [shiftData, setShiftData] = useState<{ rows: ShiftFull[]; count: number }>({ rows: [], count: 0 });
  const [odoData, setOdoData] = useState<{ rows: OdometerReading[]; count: number }>({ rows: [], count: 0 });
  const [maintData, setMaintData] = useState<{ rows: MaintenanceItem[]; count: number }>({ rows: [], count: 0 });

  const load = useCallback(async () => {
    try {
      const [v, latest, first, allShifts] = await Promise.all([
        getVehicle(vehicleId),
        getLatestOdometerForVehicle(vehicleId).catch(() => null),
        getFirstOdometerForVehicle(vehicleId).catch(() => null),
        fetchShiftsFull().catch(() => [] as ShiftFull[]),
      ]);
      setVehicle(v);
      setLatestOdo(latest);
      setFirstOdo(first);

      const vehShifts = allShifts.filter((s) => s.vehicle_id === vehicleId);
      const wkStart = startOfWeekMonday();
      setWeekShifts(
        vehShifts.filter((s) => {
          const ended = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
          return ended >= wkStart;
        })
      );
      const active = vehShifts.find((s) => !s.ended_at || s.status === 'active') ?? null;
      setActiveShift(active);

      if (active?.driver_id) {
        const [st, locs] = await Promise.all([
          getDriverCurrentStatus(active.driver_id).catch(() => null),
          listLatestLocationsByDrivers([active.driver_id]).catch(() => [] as DriverLocation[]),
        ]);
        setDriverStatus(st);
        setLocation(locs[0] ?? null);
      }
    } catch (err) {
      console.error('[VehicleProfile] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime GPS for the assigned driver
  useEffect(() => {
    if (!activeShift?.driver_id) return;
    const driverId = activeShift.driver_id;
    const channel = subscribeDriverGps(driverId, {
      onStatus: (s) => setDriverStatus((prev) => ({ ...(prev ?? ({} as DriverCurrentStatus)), ...s })),
      onLocation: (loc) => setLocation({ driver_id: driverId, latitude: loc.latitude, longitude: loc.longitude, created_at: loc.created_at }),
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [activeShift?.driver_id]);

  useEffect(() => {
    if (tab !== 'shifts') return;
    fetchShiftsFullByVehicle(vehicleId, shiftPage).then(setShiftData).catch((e) => console.error(e));
  }, [tab, vehicleId, shiftPage]);

  useEffect(() => {
    if (tab !== 'odometer') return;
    listOdometerByVehicle(vehicleId, odoPage).then(setOdoData).catch((e) => console.error(e));
  }, [tab, vehicleId, odoPage]);

  useEffect(() => {
    if (tab !== 'maintenance') return;
    listMaintenanceByVehicle(vehicleId, maintPage).then(setMaintData).catch((e) => console.error(e));
  }, [tab, vehicleId, maintPage]);

  const weekly = useMemo(() => {
    const wkStart = startOfWeekMonday();
    const now = Date.now();
    let totalMins = 0;
    weekShifts.forEach((s) => {
      const start = Math.max(new Date(s.started_at ?? 0).getTime(), wkStart);
      const end = s.ended_at ? Math.min(new Date(s.ended_at).getTime(), now) : now;
      totalMins += Math.max(0, Math.floor((end - start) / 60000));
    });
    const totalKm =
      latestOdo?.reading != null && firstOdo?.reading != null && latestOdo.reading > firstOdo.reading
        ? latestOdo.reading - firstOdo.reading
        : null;
    return { hours: totalMins / 60, shifts: weekShifts.length, totalKm };
  }, [weekShifts, latestOdo, firstOdo]);

  if (loading) {
    return (
      <ScreenContainer title="Vehicle">
        <Loader />
      </ScreenContainer>
    );
  }
  if (!vehicle) {
    return (
      <ScreenContainer title="Vehicle">
        <Empty text="Vehicle not found." />
      </ScreenContainer>
    );
  }

  const gpsActive = location?.created_at ? Date.now() - new Date(location.created_at).getTime() < 5 * 60 * 1000 : false;
  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['shifts', 'Shifts'],
    ['odometer', 'Odometer'],
    ['maintenance', 'Maintenance'],
  ];

  return (
    <ScreenContainer title={vehicle.rego} subtitle={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || undefined}>
      <ScrollView>
        <View style={styles.strip}>
          <Badge label={vehicle.status} variant={vehicle.status === 'active' ? 'green' : vehicle.status === 'maintenance' ? 'yellow' : 'gray'} />
          {vehicle.driver_name ? (
            <Pressable onPress={() => vehicle.driver_id && navigation.navigate('DriverProfile', { driverId: vehicle.driver_id })}>
              <Badge label={`Driver: ${vehicle.driver_name}`} variant="purple" />
            </Pressable>
          ) : (
            <Badge label="Unassigned" variant="gray" />
          )}
          {activeShift ? <Badge label="Active Shift" variant="blue" /> : null}
          {gpsActive ? <Badge label="GPS Active" variant="purple" /> : null}
        </View>

        <View style={styles.statRow}>
          <StatCard label="Current Odometer" value={latestOdo?.reading != null ? `${latestOdo.reading.toLocaleString()}` : '—'} color={COLORS.accent} sublabel="km" />
          <StatCard label="Total KM Logged" value={weekly.totalKm != null ? weekly.totalKm.toLocaleString() : '—'} color={COLORS.green} />
          <StatCard label="Hours This Week" value={`${weekly.hours.toFixed(1)}h`} color={COLORS.blue} />
          <StatCard label="Shifts This Week" value={weekly.shifts} color={COLORS.purple} />
        </View>

        <View style={styles.tabBar}>
          {tabs.map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' ? (
          <View>
            <Card>
              <Text style={styles.cardHeading}>Vehicle Details</Text>
              <KV k="Registration" v={vehicle.rego} />
              <KV k="Make" v={vehicle.make ?? '—'} />
              <KV k="Model" v={vehicle.model ?? '—'} />
              <KV k="Status" v={vehicle.status} />
              <KV k="Added" v={formatPerthDateTime(vehicle.created_at)} />
              <KV k="Current driver" v={vehicle.driver_name ?? 'Unassigned'} />
              <KV k="Latest odometer" v={latestOdo?.reading != null ? `${latestOdo.reading.toLocaleString()} km` : '—'} />
              {activeShift ? (
                <Btn label="View Active Shift" small variant="secondary" style={{ marginTop: 8 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: activeShift.id })} />
              ) : null}
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={styles.mapHeader}>
                <Text style={styles.cardHeading}>Live GPS</Text>
                <Text style={styles.mapSub}>
                  {location
                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} · ${formatPerthDateTime(location.created_at)}`
                    : vehicle.driver_id
                      ? 'No location data for current driver'
                      : 'No driver assigned'}
                </Text>
              </View>
              {location ? (
                <View style={{ height: 240 }}>
                  <MapWebView
                    tiles="dark"
                    center={{ lat: location.latitude, lng: location.longitude }}
                    zoom={15}
                    markers={[{ lat: location.latitude, lng: location.longitude, color: COLORS.accent, heading: driverStatus?.heading ?? 0, label: vehicle.rego }]}
                  />
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        {tab === 'shifts' ? (
          <View>
            {shiftData.rows.length === 0 ? (
              <Empty text="No shifts found." />
            ) : (
              shiftData.rows.map((s) => (
                <Card key={s.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{s.driver_name ?? 'Unknown driver'}</Text>
                    {s.ended_at ? <Badge label="Ended" variant="gray" /> : <Badge label="Active" variant="blue" />}
                  </View>
                  <KV k="Start" v={formatPerthDateTime(s.started_at)} />
                  <KV k="End" v={s.ended_at ? formatPerthDateTime(s.ended_at) : 'In progress'} />
                  <Btn label="View Shift" small variant="secondary" style={{ marginTop: 6 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: s.id })} />
                </Card>
              ))
            )}
            <Pager page={shiftPage} totalPages={Math.max(1, Math.ceil(shiftData.count / PAGE))} onPrev={() => setShiftPage((p) => p - 1)} onNext={() => setShiftPage((p) => p + 1)} />
          </View>
        ) : null}

        {tab === 'odometer' ? (
          <View>
            {odoData.rows.length === 0 ? (
              <Empty text="No odometer readings found." />
            ) : (
              odoData.rows.map((r) => (
                <Card key={r.id}>
                  <KV k="Captured" v={formatPerthDateTime(r.captured_at ?? r.created_at)} />
                  <KV k="Reading" v={r.reading != null ? `${r.reading.toLocaleString()} km` : '—'} />
                  <KV k="Location" v={r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '—'} />
                </Card>
              ))
            )}
            <Pager page={odoPage} totalPages={Math.max(1, Math.ceil(odoData.count / PAGE))} onPrev={() => setOdoPage((p) => p - 1)} onNext={() => setOdoPage((p) => p + 1)} />
          </View>
        ) : null}

        {tab === 'maintenance' ? (
          <View>
            {maintData.rows.length === 0 ? (
              <Empty text="No maintenance records found." />
            ) : (
              maintData.rows.map((m) => {
                const n = normalizeMaintenanceStatus(m.status);
                return (
                  <Card key={m.id}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.rowTitle}>{m.service_type}</Text>
                      <Badge label={n} variant={n === 'done' ? 'green' : n === 'passed' ? 'red' : 'yellow'} />
                    </View>
                    <KV k="Date" v={formatPerthDateTime(m.service_date)} />
                    <KV k="Odometer" v={m.odometer != null ? `${m.odometer.toLocaleString()} km` : '—'} />
                    <KV k="Provider" v={m.provider ?? '—'} />
                    <KV k="Cost" v={m.cost != null ? `$${m.cost}` : '—'} />
                  </Card>
                );
              })
            )}
            <Pager page={maintPage} totalPages={Math.max(1, Math.ceil(maintData.count / PAGE))} onPrev={() => setMaintPage((p) => p - 1)} onNext={() => setMaintPage((p) => p + 1)} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 10, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  cardHeading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  mapHeader: { padding: 14, paddingBottom: 8 },
  mapSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
