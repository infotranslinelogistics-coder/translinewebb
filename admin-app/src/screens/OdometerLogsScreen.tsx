import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, Badge, Btn, KV, Field, ModalSheet, Pager, Loader, Empty, COLORS } from '../components/ui';
import {
  listOdometerShiftRows,
  getCurrentOdometer,
  isShiftCompleted,
  type OdometerShiftRow,
} from '../lib/db/odometerLogs';
import { getOdometerPhotoUrl } from '../lib/storage';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import { listDriverOptions } from '../lib/db/drivers';
import { formatPerthDateTime } from '../lib/dateTime';

const PAGE = 20;

export default function OdometerLogsScreen() {
  const navigation = useNavigation<any>();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OdometerShiftRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<{ value: number | null; recordedAt: string | null }>({ value: null, recordedAt: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);

  useEffect(() => {
    listVehicles().then(setVehicles).catch(() => {});
    listDriverOptions().then(setDrivers).catch(() => {});
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: r, count: c } = await listOdometerShiftRows({ driverId, vehicleId, page, pageSize: PAGE });
      const withUrls = await Promise.all(
        r.map(async (row) => {
          const [s, e] = await Promise.all([
            row.start_photo_path ? getOdometerPhotoUrl({ photoPath: row.start_photo_path }) : Promise.resolve({ url: null, error: null }),
            row.end_photo_path ? getOdometerPhotoUrl({ photoPath: row.end_photo_path }) : Promise.resolve({ url: null, error: null }),
          ]);
          return { ...row, start_photo_url: s.url, start_photo_error: s.error, end_photo_url: e.url, end_photo_error: e.error };
        })
      );
      setRows(withUrls);
      setCount(c);
    } catch (err) {
      console.error('[OdometerLogs] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [driverId, vehicleId, page]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (vehicleId) {
      getCurrentOdometer(vehicleId).then(setCurrent).catch(() => setCurrent({ value: null, recordedAt: null }));
    } else {
      setCurrent({ value: null, recordedAt: null });
    }
  }, [vehicleId]);

  const vehLabel = (id: string | null) => (id ? vehicles.find((v) => v.id === id)?.rego ?? 'Vehicle' : 'All vehicles');
  const drvLabel = (id: string | null) => (id ? drivers.find((d) => d.id === id)?.full_name ?? 'Driver' : 'All drivers');

  const distance = (row: OdometerShiftRow): string => {
    if (row.odometer_start == null) return 'Pending';
    if (row.odometer_end == null) return isShiftCompleted(row) ? 'Missing end odometer' : 'Pending';
    const d = row.odometer_end - row.odometer_start;
    return d < 0 ? 'Invalid odometer' : `${d.toLocaleString()} km`;
  };

  return (
    <ScreenContainer title="Odometer Logs" subtitle="Start & end readings per shift">
      <ScrollView>
        <Card>
          <Text style={styles.heading}>Current Odometer</Text>
          <Btn label={`Vehicle: ${vehLabel(vehicleId)}`} small variant="secondary" onPress={() => setVehiclePickerOpen(true)} />
          <Text style={styles.bigValue}>{current.value != null ? `${current.value.toLocaleString()} km` : 'No reading yet'}</Text>
          {current.recordedAt ? <Text style={styles.sub}>Recorded: {formatPerthDateTime(current.recordedAt)}</Text> : null}
        </Card>

        <View style={styles.filters}>
          <Btn label={`Driver: ${drvLabel(driverId)}`} small variant="secondary" onPress={() => setDriverPickerOpen(true)} />
        </View>

        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Empty text="No odometer logs found." />
        ) : (
          rows.map((row) => (
            <Card key={row.shift_id}>
              <View style={styles.rowBetween}>
                <Text style={styles.driver}>{row.driver_name ?? row.driver_id ?? 'Unknown driver'}</Text>
                <Badge label={row.vehicle_rego ?? '—'} variant="purple" />
              </View>
              <KV k="Start" v={formatPerthDateTime(row.start_captured_at)} />
              <KV k="End" v={row.end_captured_at ? formatPerthDateTime(row.end_captured_at) : 'Pending'} />
              <KV k="Start KM" v={row.odometer_start != null ? `${row.odometer_start.toLocaleString()} km` : 'Pending'} />
              <KV k="End KM" v={row.odometer_end != null ? `${row.odometer_end.toLocaleString()} km` : isShiftCompleted(row) ? 'Missing end odometer' : 'Pending'} />
              <KV k="Distance" v={distance(row)} />
              <View style={styles.photoRow}>
                {row.start_photo_url ? (
                  <TouchableOpacity onPress={() => setPreview(row.start_photo_url!)}>
                    <Image source={{ uri: row.start_photo_url }} style={styles.thumb} />
                    <Text style={styles.thumbLabel}>Start</Text>
                  </TouchableOpacity>
                ) : null}
                {row.end_photo_url ? (
                  <TouchableOpacity onPress={() => setPreview(row.end_photo_url!)}>
                    <Image source={{ uri: row.end_photo_url }} style={styles.thumb} />
                    <Text style={styles.thumbLabel}>End</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Btn label="View Shift" small variant="secondary" style={{ marginTop: 8 }} onPress={() => navigation.navigate('ShiftDetail', { shiftId: row.shift_id })} />
            </Card>
          ))
        )}

        <Pager page={page} totalPages={Math.max(1, Math.ceil(count / PAGE))} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
      </ScrollView>

      {/* vehicle picker */}
      <ModalSheet visible={vehiclePickerOpen} onClose={() => setVehiclePickerOpen(false)} title="Filter by Vehicle">
        <Pressable style={styles.option} onPress={() => { setVehicleId(null); setPage(1); setVehiclePickerOpen(false); }}>
          <Text style={styles.optionText}>All vehicles</Text>
        </Pressable>
        {vehicles.map((v) => (
          <Pressable key={v.id} style={styles.option} onPress={() => { setVehicleId(v.id); setPage(1); setVehiclePickerOpen(false); }}>
            <Text style={styles.optionText}>{v.rego}{[v.make, v.model].filter(Boolean).length ? ` • ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}</Text>
          </Pressable>
        ))}
      </ModalSheet>

      {/* driver picker */}
      <ModalSheet visible={driverPickerOpen} onClose={() => setDriverPickerOpen(false)} title="Filter by Driver">
        <Pressable style={styles.option} onPress={() => { setDriverId(null); setPage(1); setDriverPickerOpen(false); }}>
          <Text style={styles.optionText}>All drivers</Text>
        </Pressable>
        {drivers.map((d) => (
          <Pressable key={d.id} style={styles.option} onPress={() => { setDriverId(d.id); setPage(1); setDriverPickerOpen(false); }}>
            <Text style={styles.optionText}>{d.full_name ?? d.id}</Text>
          </Pressable>
        ))}
      </ModalSheet>

      {/* photo preview */}
      <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  bigValue: { color: COLORS.accent, fontSize: 28, fontWeight: '800', marginTop: 10 },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  driver: { color: COLORS.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  photoRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  thumb: { width: 90, height: 64, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  thumbLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionText: { color: COLORS.text, fontSize: 15 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImg: { width: '92%', height: '80%' },
});
