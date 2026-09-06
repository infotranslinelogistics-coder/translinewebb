import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import MapWebView from '../components/MapWebView';
import { Card, StatCard, Badge, Btn, KV, Pager, Loader, Empty, COLORS } from '../components/ui';
import type { DrawerParamList } from '../types/navigation';
import { getDriver, type Driver } from '../lib/db/drivers';
import { getDriverCurrentStatus, subscribeDriverGps, type DriverCurrentStatus } from '../lib/db/liveStatus';
import { listLatestLocationsByDrivers, type DriverLocation } from '../lib/db/locations';
import { fetchShiftsFull, type ShiftFull } from '../lib/db/shifts';
import { countBreaksByShift } from '../lib/db/statusEvents';
import { listAssignmentsByDriver, type VehicleAssignmentRow } from '../lib/db/vehicleAssignments';
import { listOdometerByDriver, getLatestOdometerForDriver, type OdometerReading } from '../lib/db/odometer';
import { listDriverStatusEvents, type DriverStatusEvent } from '../lib/db/statusEvents';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import { getOdometerPhotoUrl } from '../lib/storage';
import { formatPerthDateTime } from '../lib/dateTime';

type Tab = 'overview' | 'shifts' | 'assignments' | 'odometer' | 'status';
const PAGE = 10;

function startOfWeekMonday(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function durationMins(start: string | null, end: string | null): number {
  if (!start) return 0;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((e - s) / 60000));
}

function durLabel(mins: number): string {
  return mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`;
}

export default function DriverProfileScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'DriverProfile'>>();
  const navigation = useNavigation<any>();
  const { driverId } = route.params;

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [status, setStatus] = useState<DriverCurrentStatus | null>(null);
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [shifts, setShifts] = useState<ShiftFull[]>([]);
  const [breakCounts, setBreakCounts] = useState<Record<string, number>>({});
  const [latestOdo, setLatestOdo] = useState<OdometerReading | null>(null);
  const [vehicleMap, setVehicleMap] = useState<Map<string, Vehicle>>(new Map());

  const [shiftPage, setShiftPage] = useState(1);
  const [assignPage, setAssignPage] = useState(1);
  const [odoPage, setOdoPage] = useState(1);
  const [statusPage, setStatusPage] = useState(1);
  const [assignments, setAssignments] = useState<{ rows: VehicleAssignmentRow[]; count: number }>({ rows: [], count: 0 });
  const [odoRows, setOdoRows] = useState<{ rows: (OdometerReading & { url?: string | null })[]; count: number }>({ rows: [], count: 0 });
  const [statusRows, setStatusRows] = useState<{ rows: DriverStatusEvent[]; count: number }>({ rows: [], count: 0 });

  const load = useCallback(async () => {
    try {
      const [d, st, locs, allShifts, latest, vlist] = await Promise.all([
        getDriver(driverId),
        getDriverCurrentStatus(driverId).catch(() => null),
        listLatestLocationsByDrivers([driverId]).catch(() => [] as DriverLocation[]),
        fetchShiftsFull(driverId).catch(() => [] as ShiftFull[]),
        getLatestOdometerForDriver(driverId).catch(() => null),
        listVehicles().catch(() => [] as Vehicle[]),
      ]);
      setDriver(d);
      setStatus(st);
      setLocation(locs[0] ?? null);
      setShifts(allShifts);
      setLatestOdo(latest);
      setVehicleMap(new Map(vlist.map((v) => [v.id, v])));
      const ids = allShifts.map((s) => s.id);
      if (ids.length) setBreakCounts(await countBreaksByShift(ids).catch(() => ({})));
    } catch (err) {
      console.error('[DriverProfile] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime GPS
  useEffect(() => {
    const channel = subscribeDriverGps(driverId, {
      onStatus: (s) => setStatus((prev) => ({ ...(prev ?? ({} as DriverCurrentStatus)), ...s })),
      onLocation: (loc) => setLocation({ driver_id: driverId, latitude: loc.latitude, longitude: loc.longitude, created_at: loc.created_at }),
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [driverId]);

  useEffect(() => {
    if (tab !== 'assignments') return;
    listAssignmentsByDriver(driverId, assignPage).then(setAssignments).catch((e) => console.error(e));
  }, [tab, driverId, assignPage]);

  useEffect(() => {
    if (tab !== 'odometer') return;
    listOdometerByDriver(driverId, odoPage)
      .then(async ({ rows, count }) => {
        const withUrls = await Promise.all(
          rows.map(async (r) => ({ ...r, url: r.photo_path ? (await getOdometerPhotoUrl({ photoPath: r.photo_path })).url : null }))
        );
        setOdoRows({ rows: withUrls, count });
      })
      .catch((e) => console.error(e));
  }, [tab, driverId, odoPage]);

  useEffect(() => {
    if (tab !== 'status') return;
    listDriverStatusEvents(driverId, statusPage).then(setStatusRows).catch((e) => console.error(e));
  }, [tab, driverId, statusPage]);

  const weekly = useMemo(() => {
    const wkStart = startOfWeekMonday().getTime();
    const now = Date.now();
    const weekShifts = shifts.filter((s) => {
      const started = s.started_at ? new Date(s.started_at).getTime() : 0;
      const ended = s.ended_at ? new Date(s.ended_at).getTime() : now;
      return started <= now && ended >= wkStart;
    });
    let totalMins = 0;
    let counted = 0;
    weekShifts.forEach((s) => {
      const start = Math.max(new Date(s.started_at ?? 0).getTime(), wkStart);
      const end = s.ended_at ? Math.min(new Date(s.ended_at).getTime(), now) : now;
      const mins = Math.max(0, Math.floor((end - start) / 60000));
      if (mins > 0) {
        totalMins += mins;
        counted += 1;
      }
    });
    return {
      hours: totalMins / 60,
      shiftCount: weekShifts.length,
      avg: counted > 0 ? totalMins / 60 / counted : 0,
    };
  }, [shifts]);

  const activeShift = useMemo(() => shifts.find((s) => !s.ended_at || s.status === 'active') ?? null, [shifts]);

  const vehLabel = (id: string | null | undefined) => {
    if (!id) return '—';
    const v = vehicleMap.get(id);
    if (!v) return id.slice(0, 8);
    const mm = [v.make, v.model].filter(Boolean).join(' ');
    return mm ? `${v.rego} • ${mm}` : v.rego;
  };

  if (loading) {
    return (
      <ScreenContainer title="Driver">
        <Loader />
      </ScreenContainer>
    );
  }
  if (!driver) {
    return (
      <ScreenContainer title="Driver">
        <Empty text="Driver not found." />
      </ScreenContainer>
    );
  }

  const gpsActive = location?.created_at ? Date.now() - new Date(location.created_at).getTime() < 5 * 60 * 1000 : false;
  const online = location?.created_at
    ? Date.now() - new Date(location.created_at).getTime() < 60 * 1000
    : status?.last_seen_at
      ? Date.now() - new Date(status.last_seen_at).getTime() < 60 * 1000
      : Boolean(status?.is_online);

  const tabs: [Tab, string][] = [
    ['overview', 'Overview'],
    ['shifts', 'Shifts'],
    ['assignments', 'Vehicles'],
    ['odometer', 'Odometer'],
    ['status', 'Status'],
  ];

  const pagedShifts = shifts.slice((shiftPage - 1) * PAGE, shiftPage * PAGE);

  return (
    <ScreenContainer title={driver.full_name ?? 'Driver'} subtitle={driver.email ?? driver.phone ?? undefined}>
      <ScrollView>
        <View style={styles.strip}>
          {online ? <Badge label="Online" variant="green" /> : <Badge label="Offline" variant="gray" />}
          {activeShift ? <Badge label="On Shift" variant="blue" /> : <Badge label="Off Shift" variant="gray" />}
          {status?.on_break ? <Badge label="On Break" variant="yellow" /> : null}
          {gpsActive ? <Badge label="GPS Active" variant="purple" /> : null}
          {driver.status ? <Badge label={driver.status} variant="gray" /> : null}
        </View>

        <View style={styles.statRow}>
          <StatCard label="Hours This Week" value={`${weekly.hours.toFixed(1)}h`} color={COLORS.accent} />
          <StatCard label="Shifts This Week" value={weekly.shiftCount} color={COLORS.blue} />
          <StatCard label="Avg Shift" value={weekly.shiftCount ? `${weekly.avg.toFixed(1)}h` : '—'} color={COLORS.green} />
          <StatCard label="Total Shifts" value={shifts.length} color={COLORS.purple} />
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
              <Text style={styles.cardHeading}>Driver Details</Text>
              <KV k="Driver name" v={driver.full_name ?? '—'} />
              <KV k="Email" v={driver.email ?? '—'} />
              <KV k="Phone" v={driver.phone ?? '—'} />
              <KV k="Driver ID" v={driver.driver_id} />
            </Card>

            <Card>
              <Text style={styles.cardHeading}>Current Status</Text>
              <KV k="Last seen" v={status?.last_seen_at ? formatPerthDateTime(status.last_seen_at) : 'Never'} />
              <KV k="GPS sharing" v={gpsActive ? 'Active' : 'Inactive'} />
              <KV k="On shift since" v={activeShift?.started_at ? formatPerthDateTime(activeShift.started_at) : 'Not on shift'} />
              <KV k="Assigned vehicle" v={vehLabel(activeShift?.vehicle_id ?? status?.vehicle_id)} />
              <KV k="Latest odometer" v={latestOdo?.reading != null ? `${latestOdo.reading.toLocaleString()} km` : '—'} />
              {activeShift ? (
                <Btn label="View Active Shift" small variant="secondary" style={{ marginTop: 8 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: activeShift.id })} />
              ) : null}
            </Card>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={styles.mapHeader}>
                <Text style={styles.cardHeading}>Live GPS</Text>
                {location ? (
                  <Text style={styles.mapSub}>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · {formatPerthDateTime(location.created_at)}
                  </Text>
                ) : (
                  <Text style={styles.mapSub}>No location data available</Text>
                )}
              </View>
              {location ? (
                <View style={{ height: 240 }}>
                  <MapWebView
                    tiles="dark"
                    center={{ lat: location.latitude, lng: location.longitude }}
                    zoom={15}
                    markers={[{ lat: location.latitude, lng: location.longitude, color: COLORS.accent, heading: status?.heading ?? 0, label: driver.full_name ?? 'Driver' }]}
                  />
                </View>
              ) : null}
            </Card>

            {latestOdo ? (
              <Card>
                <Text style={styles.cardHeading}>Latest Odometer</Text>
                <KV k="Reading" v={latestOdo.reading != null ? `${latestOdo.reading.toLocaleString()} km` : '—'} />
                <KV k="Captured" v={formatPerthDateTime(latestOdo.captured_at ?? latestOdo.created_at)} />
                <OdoPhoto photoPath={latestOdo.photo_path} />
              </Card>
            ) : null}
          </View>
        ) : null}

        {tab === 'shifts' ? (
          <View>
            {pagedShifts.length === 0 ? (
              <Empty text="No shifts found." />
            ) : (
              pagedShifts.map((s) => (
                <Card key={s.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{formatPerthDateTime(s.started_at)}</Text>
                    {s.ended_at ? <Badge label="Ended" variant="gray" /> : <Badge label="Active" variant="blue" />}
                  </View>
                  <KV k="End" v={s.ended_at ? formatPerthDateTime(s.ended_at) : 'In progress'} />
                  <KV k="Duration" v={durLabel(durationMins(s.started_at, s.ended_at))} />
                  <KV k="Breaks" v={String(breakCounts[s.id] ?? 0)} />
                  <KV k="Vehicle" v={vehLabel(s.vehicle_id)} />
                  <Btn label="View Shift" small variant="secondary" style={{ marginTop: 6 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: s.id })} />
                </Card>
              ))
            )}
            <Pager page={shiftPage} totalPages={Math.max(1, Math.ceil(shifts.length / PAGE))} onPrev={() => setShiftPage((p) => p - 1)} onNext={() => setShiftPage((p) => p + 1)} />
          </View>
        ) : null}

        {tab === 'assignments' ? (
          <View>
            {assignments.rows.length === 0 ? (
              <Empty text="No assignments found." />
            ) : (
              assignments.rows.map((a) => (
                <Card key={a.id}>
                  <KV k="Vehicle" v={vehLabel(a.vehicle_id)} />
                  <KV k="Assigned" v={formatPerthDateTime(a.assigned_at)} />
                  <KV k="Unassigned" v={a.unassigned_at ? formatPerthDateTime(a.unassigned_at) : 'Current'} />
                </Card>
              ))
            )}
            <Pager page={assignPage} totalPages={Math.max(1, Math.ceil(assignments.count / PAGE))} onPrev={() => setAssignPage((p) => p - 1)} onNext={() => setAssignPage((p) => p + 1)} />
          </View>
        ) : null}

        {tab === 'odometer' ? (
          <View>
            {odoRows.rows.length === 0 ? (
              <Empty text="No odometer logs found." />
            ) : (
              odoRows.rows.map((r) => (
                <Card key={r.id}>
                  <KV k="Recorded" v={formatPerthDateTime(r.captured_at ?? r.created_at)} />
                  <KV k="Vehicle" v={vehLabel(r.vehicle_id)} />
                  <KV k="Reading" v={r.reading != null ? `${r.reading.toLocaleString()} km` : '—'} />
                  <KV k="Location" v={r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '—'} />
                  {r.url ? <Image source={{ uri: r.url }} style={styles.odoImg} resizeMode="cover" /> : null}
                </Card>
              ))
            )}
            <Pager page={odoPage} totalPages={Math.max(1, Math.ceil(odoRows.count / PAGE))} onPrev={() => setOdoPage((p) => p - 1)} onNext={() => setOdoPage((p) => p + 1)} />
          </View>
        ) : null}

        {tab === 'status' ? (
          <View>
            {statusRows.rows.length === 0 ? (
              <Empty text="No status events found." />
            ) : (
              statusRows.rows.map((ev) => (
                <Card key={ev.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{ev.state ?? 'unknown'}</Text>
                    {ev.ended_at ? <Badge label="Ended" variant="gray" /> : <Badge label="Active" variant="blue" />}
                  </View>
                  <KV k="Started" v={formatPerthDateTime(ev.started_at)} />
                  <KV k="Ended" v={ev.ended_at ? formatPerthDateTime(ev.ended_at) : '—'} />
                  {ev.shift_id ? <Btn label="View Shift" small variant="secondary" style={{ marginTop: 6 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: ev.shift_id! })} /> : null}
                </Card>
              ))
            )}
            <Pager page={statusPage} totalPages={Math.max(1, Math.ceil(statusRows.count / PAGE))} onPrev={() => setStatusPage((p) => p - 1)} onNext={() => setStatusPage((p) => p + 1)} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function OdoPhoto({ photoPath }: { photoPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (photoPath) {
      getOdometerPhotoUrl({ photoPath }).then((r) => {
        if (!cancelled) setUrl(r.url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [photoPath]);
  if (!url) return null;
  return <Image source={{ uri: url }} style={styles.odoImg} resizeMode="cover" />;
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
  odoImg: { width: '100%', height: 160, borderRadius: 8, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
