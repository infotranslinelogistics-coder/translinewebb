import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import MapWebView, { type MapMarker, type MapRoute } from '../components/MapWebView';
import { Card, Badge, Btn, KV, Loader, Empty, COLORS } from '../components/ui';
import type { DrawerParamList } from '../types/navigation';
import { fetchShiftWithEvents, forceEndShift, deleteShiftAdmin, type ShiftEvent, type ShiftFull } from '../lib/db/shifts';
import { summarizeBreakAllowance, computeWorkingSeconds } from '../lib/breakAllowance';
import { getOdometerPhotoUrl } from '../lib/storage';
import { formatPerthDateTime } from '../lib/dateTime';

function num(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function eventLabel(t: string): string {
  const map: Record<string, string> = {
    shift_start: 'Shift started',
    shift_end: 'Shift ended',
    break_start: 'Break started',
    break_end: 'Break ended',
    odometer_start: 'Start odometer',
    odometer_end: 'End odometer',
    fuel_log: 'Fuel log',
    driver_log: 'Driver log',
    stop_detected: 'Stop detected',
    location: 'Location update',
  };
  return map[t] ?? t.replace(/_/g, ' ');
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

export default function ShiftDetailScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'ShiftDetail'>>();
  const navigation = useNavigation<any>();
  const { shiftId } = route.params;

  const [shift, setShift] = useState<ShiftFull | null>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [startPhoto, setStartPhoto] = useState<string | null>(null);
  const [endPhoto, setEndPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchShiftWithEvents(shiftId);
      setShift(result.shift);
      setEvents(result.events);
    } catch (err) {
      console.error('[ShiftDetail] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  // odometer/fuel extraction
  const odoFuel = useMemo(() => {
    const start = events.find((e) => e.event_type === 'odometer_start');
    const end = events.find((e) => e.event_type === 'odometer_end');
    const fuelLogs = events.filter((e) => e.event_type === 'fuel_log');
    const startKm = num(start?.metadata?.odometer_value);
    const endKm = num(end?.metadata?.odometer_value);
    const totalLitres = fuelLogs.reduce((sum, f) => sum + (num(f.metadata?.litres) ?? 0), 0);
    const totalCost = fuelLogs.reduce((sum, f) => sum + (num(f.metadata?.cost) ?? 0), 0);
    return {
      startKm,
      endKm,
      distance: startKm != null && endKm != null ? endKm - startKm : null,
      fuelCount: fuelLogs.length,
      totalLitres,
      totalCost,
      startPhotoPath: (start?.metadata?.photo_path as string) ?? null,
      endPhotoPath: (end?.metadata?.photo_path as string) ?? null,
      fuelLogs,
    };
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (odoFuel.startPhotoPath) {
        const r = await getOdometerPhotoUrl({ photoPath: odoFuel.startPhotoPath });
        if (!cancelled) setStartPhoto(r.url);
      }
      if (odoFuel.endPhotoPath) {
        const r = await getOdometerPhotoUrl({ photoPath: odoFuel.endPhotoPath });
        if (!cancelled) setEndPhoto(r.url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [odoFuel.startPhotoPath, odoFuel.endPhotoPath]);

  const breakSummary = useMemo(
    () => summarizeBreakAllowance(events.map((e) => ({ event_type: e.event_type, created_at: e.created_at }))),
    [events]
  );
  const workingSeconds = useMemo(
    () => (shift ? computeWorkingSeconds(shift.started_at, shift.ended_at, breakSummary) : null),
    [shift, breakSummary]
  );

  const locationEvents = useMemo(
    () => events.filter((e) => e.event_type === 'location' && e.latitude != null && e.longitude != null),
    [events]
  );

  const mapData = useMemo((): { route: MapRoute | null; markers: MapMarker[] } => {
    if (!shift) return { route: null, markers: [] };
    const startLat = shift.start_lat ?? locationEvents[0]?.latitude ?? null;
    const startLng = shift.start_lng ?? locationEvents[0]?.longitude ?? null;
    const last = locationEvents[locationEvents.length - 1];
    const endLat = shift.end_lat ?? last?.latitude ?? null;
    const endLng = shift.end_lng ?? last?.longitude ?? null;
    const stops: MapMarker[] = events
      .filter((e) => e.event_type === 'stop_detected' && e.latitude != null && e.longitude != null)
      .map((e) => ({ lat: e.latitude as number, lng: e.longitude as number, color: '#f59e0b', radius: 7, label: `Stop · ${formatPerthDateTime(e.created_at)}` }));

    if (startLat != null && startLng != null && endLat != null && endLng != null) {
      return {
        route: { startLat, startLng, endLat, endLng, completed: Boolean(shift.ended_at) },
        markers: stops,
      };
    }
    return { route: null, markers: stops };
  }, [shift, locationEvents, events]);

  // condensed timeline (collapse runs of >2 location events)
  const timeline = useMemo(() => {
    const out: { label: string; time: string; detail?: string }[] = [];
    let locRun = 0;
    let lastLocTime = '';
    const flush = () => {
      if (locRun > 0) {
        out.push({ label: locRun > 2 ? `${locRun} location updates` : 'Location update', time: lastLocTime });
        locRun = 0;
      }
    };
    events.forEach((e) => {
      if (e.event_type === 'location') {
        locRun += 1;
        lastLocTime = e.created_at;
        return;
      }
      flush();
      const reason = (e.metadata?.reason as string) ?? null;
      const coords = e.latitude != null && e.longitude != null ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : null;
      out.push({ label: eventLabel(e.event_type), time: e.created_at, detail: reason ?? coords ?? undefined });
    });
    flush();
    return out;
  }, [events]);

  const handleForceEnd = () => {
    Alert.alert('Force End Shift', 'This will immediately end the active shift. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Force End',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await forceEndShift(shiftId);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to end shift.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Shift', 'This deletes the shift and all related events. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteShiftAdmin(shiftId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete shift.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer title="Shift">
        <Loader />
      </ScreenContainer>
    );
  }
  if (!shift) {
    return (
      <ScreenContainer title="Shift">
        <Empty text="Shift not found." />
      </ScreenContainer>
    );
  }

  const checklistEntries = Object.entries(shift.checklist ?? {});

  return (
    <ScreenContainer title={shift.driver_name ?? 'Shift'} subtitle={shift.vehicle_rego ?? undefined}>
      <ScrollView>
        <Card>
          <Text style={styles.heading}>Overview</Text>
          <KV k="Driver" v={shift.driver_name ?? shift.driver_id ?? '—'} />
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Vehicle</Text>
            {shift.vehicle_id ? (
              <Pressable onPress={() => navigation.navigate('VehicleProfile', { vehicleId: shift.vehicle_id! })}>
                <Text style={[styles.kvVal, { color: COLORS.accent }]}>{shift.vehicle_rego ?? shift.vehicle_id}</Text>
              </Pressable>
            ) : (
              <Text style={styles.kvVal}>—</Text>
            )}
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Status</Text>
            {shift.ended_at ? <Badge label={shift.status ?? 'ended'} variant="gray" /> : <Badge label="Active" variant="green" />}
          </View>
          <KV k="Started" v={formatPerthDateTime(shift.started_at)} />
          <KV k="Ended" v={shift.ended_at ? formatPerthDateTime(shift.ended_at) : 'In progress'} />
          <KV k="Location updates" v={String(locationEvents.length)} />
          {!shift.ended_at ? (
            <Btn label={busy ? 'Ending…' : 'Force End Shift'} variant="danger" style={{ marginTop: 10 }} disabled={busy} onPress={handleForceEnd} />
          ) : null}
        </Card>

        {mapData.route ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={styles.mapHeader}>
              <Text style={styles.heading}>GPS Route</Text>
              <Text style={styles.mapSub}>{locationEvents.length} GPS points</Text>
            </View>
            <View style={{ height: 280 }}>
              <MapWebView route={mapData.route} markers={mapData.markers} tiles="osm" />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={styles.heading}>GPS Route</Text>
            <Empty text="No GPS data available." />
          </Card>
        )}

        <Card>
          <Text style={styles.heading}>Odometer & Fuel</Text>
          <KV k="Start KM" v={odoFuel.startKm != null ? `${odoFuel.startKm.toLocaleString()} km` : 'Pending'} />
          <KV k="End KM" v={odoFuel.endKm != null ? `${odoFuel.endKm.toLocaleString()} km` : shift.ended_at ? 'Missing end odometer' : 'Pending'} />
          <KV
            k="Distance"
            v={odoFuel.distance != null ? (odoFuel.distance < 0 ? 'Invalid odometer' : `${odoFuel.distance.toLocaleString()} km`) : '—'}
          />
          <KV k="Fuel logs" v={String(odoFuel.fuelCount)} />
          {odoFuel.fuelCount > 0 ? (
            <KV k="Fuel total" v={`${odoFuel.totalLitres.toFixed(1)} L · $${odoFuel.totalCost.toFixed(2)}`} />
          ) : null}
          {startPhoto ? (
            <>
              <Text style={styles.photoLabel}>Start photo</Text>
              <Image source={{ uri: startPhoto }} style={styles.photo} resizeMode="cover" />
            </>
          ) : null}
          {endPhoto ? (
            <>
              <Text style={styles.photoLabel}>End photo</Text>
              <Image source={{ uri: endPhoto }} style={styles.photo} resizeMode="cover" />
            </>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Break Summary</Text>
          <KV k="Status" v={breakSummary.isOnBreak ? 'On break' : breakSummary.sessions.length ? 'Completed' : 'No break taken'} />
          <KV k="Raw break time" v={fmtDuration(breakSummary.rawBreakSeconds)} />
          <KV k="Allowed" v={fmtDuration(breakSummary.allowanceSeconds)} />
          <KV k="Counted for payroll" v={fmtDuration(breakSummary.countedBreakSeconds)} />
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Allowance</Text>
            <Badge label={breakSummary.status === 'exceeded' ? 'Exceeded' : 'Within'} variant={breakSummary.status === 'exceeded' ? 'red' : 'green'} />
          </View>
          {workingSeconds != null ? <KV k="Working time" v={fmtDuration(workingSeconds)} /> : null}
          <KV k="Break sessions" v={String(breakSummary.sessions.length)} />
          {breakSummary.shouldAutoEndCurrentBreak ? <Text style={styles.warn}>Break allowance exceeded — should auto-end.</Text> : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Checklist</Text>
          {checklistEntries.length === 0 ? (
            <Empty text="No checklist submitted." />
          ) : (
            checklistEntries.map(([key, value]) => (
              <View key={key} style={styles.kvRow}>
                <Text style={styles.kvKey}>{key.replace(/_/g, ' ')}</Text>
                <Badge label={value ?? 'pending'} variant={value === 'fail' ? 'red' : value === 'pass' ? 'green' : 'yellow'} />
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={styles.heading}>Timeline</Text>
          {timeline.length === 0 ? (
            <Empty text="No events found." />
          ) : (
            timeline.map((t, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>{t.label}</Text>
                  <Text style={styles.timelineTime}>{formatPerthDateTime(t.time)}</Text>
                  {t.detail ? <Text style={styles.timelineDetail}>{t.detail}</Text> : null}
                </View>
              </View>
            ))
          )}
        </Card>

        <Btn label={busy ? '…' : 'Delete Shift'} variant="danger" disabled={busy} onPress={handleDelete} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 12 },
  kvKey: { color: COLORS.subtle, fontSize: 13, textTransform: 'capitalize' },
  kvVal: { color: COLORS.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  mapHeader: { padding: 14, paddingBottom: 8 },
  mapSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  photoLabel: { color: COLORS.muted, fontSize: 12, marginTop: 8 },
  photo: { width: '100%', height: 160, borderRadius: 8, marginTop: 6 },
  warn: { color: COLORS.red, fontSize: 12, marginTop: 6 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginTop: 5 },
  timelineLabel: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  timelineTime: { color: COLORS.muted, fontSize: 11, marginTop: 1 },
  timelineDetail: { color: COLORS.subtle, fontSize: 11, marginTop: 1 },
});
