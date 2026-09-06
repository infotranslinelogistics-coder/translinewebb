import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, ModalSheet, Loader, Empty, COLORS } from '../components/ui';
import { supabase } from '../lib/supabase';
import { listDrivers, sendDriverPasswordReset, type Driver } from '../lib/db/drivers';
import { createDriver, deleteDriver, isAdminApiConfigured } from '../lib/api/admin';
import { listDriverCurrentStatus, type DriverCurrentStatus } from '../lib/db/liveStatus';
import { getActiveShiftsByDriver } from '../lib/db/shifts';
import { listVehicles, assignDriverToVehicle, unassignDriver, type Vehicle } from '../lib/db/vehicles';

function durationLabel(startedAt: string | null | undefined): string {
  if (!startedAt) return '—';
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DriversScreen() {
  const navigation = useNavigation<any>();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, DriverCurrentStatus>>({});
  const [activeShiftByDriver, setActiveShiftByDriver] = useState<Map<string, { id: string; started_at: string | null }>>(new Map());
  const [onBreakSet, setOnBreakSet] = useState<Set<string>>(new Set());
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [, setNow] = useState(Date.now());

  const [addOpen, setAddOpen] = useState(false);
  const [manageDriver, setManageDriver] = useState<Driver | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, statuses, shiftMap, vlist] = await Promise.all([
        listDrivers(),
        listDriverCurrentStatus().catch(() => [] as DriverCurrentStatus[]),
        getActiveShiftsByDriver().catch(() => new Map()),
        listVehicles().catch(() => [] as Vehicle[]),
      ]);
      setDrivers(d);
      setStatusMap(Object.fromEntries(statuses.map((s) => [s.driver_id, s])));
      setActiveShiftByDriver(shiftMap as Map<string, { id: string; started_at: string | null }>);
      setVehicles(vlist);

      const shiftIds = Array.from((shiftMap as Map<string, { id: string }>).values()).map((s) => s.id);
      if (shiftIds.length > 0) {
        const { data: events } = await supabase
          .from('shift_events')
          .select('shift_id, event_type, created_at')
          .in('shift_id', shiftIds)
          .in('event_type', ['break_start', 'break_end'])
          .order('created_at', { ascending: false });
        const latestByShift = new Map<string, string>();
        (events ?? []).forEach((e: any) => {
          if (!latestByShift.has(e.shift_id)) latestByShift.set(e.shift_id, e.event_type);
        });
        const breakDrivers = new Set<string>();
        (shiftMap as Map<string, { id: string }>).forEach((shift, driverId) => {
          if (latestByShift.get(shift.id) === 'break_start') breakDrivers.add(driverId);
        });
        setOnBreakSet(breakDrivers);
      } else {
        setOnBreakSet(new Set());
      }
    } catch (err) {
      console.error('[Drivers] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // live duration tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // realtime presence/status/location → refetch
  useEffect(() => {
    const channel = supabase
      .channel('admin-drivers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_presence' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_status_events' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const activeCount = useMemo(() => drivers.filter((d) => d.status === 'active').length, [drivers]);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = drivers.filter((d) => {
      if (!q) return true;
      return (
        d.full_name?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.phone?.includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      const sa = activeShiftByDriver.get(a.driver_id);
      const sb = activeShiftByDriver.get(b.driver_id);
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      if (sa && sb) {
        return new Date(sb.started_at ?? 0).getTime() - new Date(sa.started_at ?? 0).getTime();
      }
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });
  }, [drivers, search, activeShiftByDriver]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setFormError(null);
  };

  const handleAdd = async () => {
    setFormError(null);
    if (!isAdminApiConfigured) {
      setFormError('Set EXPO_PUBLIC_API_BASE_URL to enable creating drivers.');
      return;
    }
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFormError('Name, email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await createDriver({ email: email.trim(), password, full_name: fullName.trim(), phone: phone.trim() || null });
      setAddOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create driver.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (driver: Driver) => {
    if (!isAdminApiConfigured) {
      setFormError('Set EXPO_PUBLIC_API_BASE_URL to enable deleting drivers.');
      return;
    }
    setBusy(true);
    try {
      await deleteDriver(driver.driver_id);
      setManageDriver(null);
      await load();
    } catch (err) {
      console.error('[Drivers] delete failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (driver: Driver) => {
    if (!driver.email) return;
    setBusy(true);
    try {
      await sendDriverPasswordReset(driver.email);
      setManageDriver(null);
    } catch (err) {
      console.error('[Drivers] reset password failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async (vehicleId: string | null) => {
    if (!manageDriver) return;
    setBusy(true);
    try {
      if (vehicleId) {
        await assignDriverToVehicle(vehicleId, manageDriver.driver_id);
      } else {
        await unassignDriver(manageDriver.driver_id);
      }
      setAssignOpen(false);
      setManageDriver(null);
      await load();
    } catch (err) {
      console.error('[Drivers] assign failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer title="Drivers" subtitle="Manage your driver fleet">
      <View style={styles.statRow}>
        <StatCard label="Total Drivers" value={drivers.length} />
        <StatCard label="Active" value={activeCount} color={COLORS.green} />
        <StatCard label="Offline" value={drivers.length - activeCount} color={COLORS.blue} />
      </View>

      <View style={styles.toolbar}>
        <Field placeholder="Search drivers..." value={search} onChangeText={setSearch} style={{ flex: 1, marginBottom: 0 }} />
        <Btn label="+ Add" small onPress={() => { resetForm(); setAddOpen(true); }} />
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.driver_id}
          ListEmptyComponent={<Empty text="No drivers found." />}
          renderItem={({ item }) => {
            const status = statusMap[item.driver_id];
            const shift = activeShiftByDriver.get(item.driver_id);
            const online = item.online_status === 'online' || status?.is_online;
            return (
              <Pressable style={styles.row} onPress={() => navigation.navigate('DriverProfile', { driverId: item.driver_id })}>
                <View style={[styles.dot, online && { backgroundColor: COLORS.green }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.full_name ?? item.email ?? item.driver_id}</Text>
                  <Text style={styles.sub}>{item.email ?? item.phone ?? 'No contact'}</Text>
                  <View style={styles.badges}>
                    {shift ? <Badge label={`On Shift · ${durationLabel(shift.started_at)}`} variant="blue" /> : <Badge label="Off Shift" variant="gray" />}
                    {status?.status_state ? <Badge label={status.status_state} variant="accent" /> : null}
                    {onBreakSet.has(item.driver_id) ? <Badge label="On Break" variant="yellow" /> : null}
                    {item.current_vehicle_rego ? <Badge label={item.current_vehicle_rego} variant="purple" /> : null}
                  </View>
                </View>
                <Btn label="Manage" small variant="secondary" onPress={() => setManageDriver(item)} />
              </Pressable>
            );
          }}
        />
      )}

      {/* Add Driver */}
      <ModalSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add Driver">
        <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Jane Driver" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="jane@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Temporary password" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="04xx xxx xxx" />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Btn label={busy ? 'Creating…' : 'Create Driver'} disabled={busy} onPress={handleAdd} />
        <Btn label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
      </ModalSheet>

      {/* Manage driver */}
      <ModalSheet visible={Boolean(manageDriver) && !assignOpen} onClose={() => setManageDriver(null)} title={manageDriver?.full_name ?? 'Driver'}>
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Btn label="View Profile" variant="secondary" onPress={() => { const d = manageDriver; setManageDriver(null); if (d) navigation.navigate('DriverProfile', { driverId: d.driver_id }); }} />
        <Btn label="Change Assigned Vehicle" variant="secondary" style={{ marginTop: 8 }} onPress={() => setAssignOpen(true)} />
        <Btn label="Send Password Reset" variant="secondary" style={{ marginTop: 8 }} disabled={busy || !manageDriver?.email} onPress={() => manageDriver && handleResetPassword(manageDriver)} />
        <Btn label={busy ? '…' : 'Delete Driver'} variant="danger" style={{ marginTop: 8 }} disabled={busy} onPress={() => manageDriver && handleDelete(manageDriver)} />
        <Btn label="Close" variant="ghost" onPress={() => setManageDriver(null)} />
      </ModalSheet>

      {/* Assign vehicle */}
      <ModalSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Vehicle">
        <Pressable style={styles.option} onPress={() => handleAssign(null)}>
          <Text style={styles.optionText}>Unassigned</Text>
        </Pressable>
        {vehicles
          .filter((v) => v.status === 'active')
          .map((vch) => {
            const takenByOther = vch.driver_id && vch.driver_id !== manageDriver?.driver_id;
            return (
              <Pressable key={vch.id} style={styles.option} disabled={busy} onPress={() => handleAssign(vch.id)}>
                <Text style={styles.optionText}>
                  {vch.rego}
                  {takenByOther ? ` (assigned to ${vch.driver_name ?? 'another'})` : ''}
                </Text>
              </Pressable>
            );
          })}
        <Btn label="Cancel" variant="ghost" onPress={() => setAssignOpen(false)} />
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#4B5563' },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionText: { color: COLORS.text, fontSize: 15 },
});
