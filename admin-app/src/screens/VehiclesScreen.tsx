import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, ModalSheet, Loader, Empty, COLORS } from '../components/ui';
import {
  listVehicles,
  createVehicle,
  deleteVehicle,
  assignDriverToVehicle,
  getVehicleIdsOnActiveShift,
  type Vehicle,
} from '../lib/db/vehicles';
import { listDriverOptions } from '../lib/db/drivers';

function statusVariant(status: string): 'green' | 'yellow' | 'gray' {
  if (status === 'active') return 'green';
  if (status === 'maintenance') return 'yellow';
  return 'gray';
}

export default function VehiclesScreen() {
  const navigation = useNavigation<any>();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [onShift, setOnShift] = useState<Set<string>>(new Set());
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [manageVehicle, setManageVehicle] = useState<Vehicle | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [rego, setRego] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');

  const load = useCallback(async () => {
    try {
      const [v, shiftIds, d] = await Promise.all([
        listVehicles(),
        getVehicleIdsOnActiveShift().catch(() => new Set<string>()),
        listDriverOptions().catch(() => []),
      ]);
      setVehicles(v);
      setOnShift(shiftIds);
      setDrivers(d);
    } catch (err) {
      console.error('[Vehicles] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const active = vehicles.filter((v) => v.status === 'active').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;
    return {
      total: vehicles.length,
      active,
      maintenance,
      onShift: vehicles.filter((v) => onShift.has(v.id)).length,
      inactive: vehicles.length - active - maintenance,
    };
  }, [vehicles, onShift]);

  const filtered = vehicles.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return v.rego.toLowerCase().includes(q) || v.make?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    setFormError(null);
    if (!rego.trim()) {
      setFormError('Rego is required.');
      return;
    }
    setBusy(true);
    try {
      await createVehicle({ rego: rego.trim(), make: make.trim() || null, model: model.trim() || null });
      setAddOpen(false);
      setRego('');
      setMake('');
      setModel('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create vehicle.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    setBusy(true);
    try {
      await deleteVehicle(v.id);
      setManageVehicle(null);
      await load();
    } catch (err) {
      console.error('[Vehicles] delete failed', err);
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async (driverId: string | null) => {
    if (!manageVehicle) return;
    setBusy(true);
    try {
      await assignDriverToVehicle(manageVehicle.id, driverId);
      setAssignOpen(false);
      setManageVehicle(null);
      await load();
    } catch (err) {
      console.error('[Vehicles] assign failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer title="Vehicles" subtitle="Manage your vehicle fleet">
      <View style={styles.statRow}>
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Active" value={counts.active} color={COLORS.green} />
        <StatCard label="On Shift" value={counts.onShift} color={COLORS.blue} />
        <StatCard label="Maintenance" value={counts.maintenance} color={COLORS.yellow} />
        <StatCard label="Inactive" value={counts.inactive} color={COLORS.muted} />
      </View>

      <View style={styles.toolbar}>
        <Field placeholder="Search vehicles..." value={search} onChangeText={setSearch} style={{ flex: 1, marginBottom: 0 }} />
        <Btn label="+ Add" small onPress={() => { setFormError(null); setAddOpen(true); }} />
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="No vehicles found." />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('VehicleProfile', { vehicleId: item.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rego}>{item.rego}</Text>
                <Text style={styles.sub}>{[item.make, item.model].filter(Boolean).join(' ') || 'Unknown vehicle'}</Text>
                <View style={styles.badges}>
                  <Badge label={item.status} variant={statusVariant(item.status)} />
                  {onShift.has(item.id) ? <Badge label="On Shift" variant="blue" /> : <Badge label="Off Shift" variant="gray" />}
                  <Badge label={item.driver_name ?? 'Unassigned'} variant={item.driver_name ? 'purple' : 'gray'} />
                </View>
              </View>
              <Btn label="Manage" small variant="secondary" onPress={() => setManageVehicle(item)} />
            </Pressable>
          )}
        />
      )}

      <ModalSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add Vehicle">
        <Field label="Rego" value={rego} onChangeText={setRego} autoCapitalize="characters" placeholder="ABC123" />
        <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChangeText={setModel} placeholder="Hilux" />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Btn label={busy ? 'Creating…' : 'Create Vehicle'} disabled={busy} onPress={handleAdd} />
        <Btn label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
      </ModalSheet>

      <ModalSheet visible={Boolean(manageVehicle) && !assignOpen} onClose={() => setManageVehicle(null)} title={manageVehicle?.rego ?? 'Vehicle'}>
        <Btn label="View Profile" variant="secondary" onPress={() => { const v = manageVehicle; setManageVehicle(null); if (v) navigation.navigate('VehicleProfile', { vehicleId: v.id }); }} />
        <Btn label="Assign Driver" variant="secondary" style={{ marginTop: 8 }} onPress={() => setAssignOpen(true)} />
        <Btn label={busy ? '…' : 'Delete Vehicle'} variant="danger" style={{ marginTop: 8 }} disabled={busy} onPress={() => manageVehicle && handleDelete(manageVehicle)} />
        <Btn label="Close" variant="ghost" onPress={() => setManageVehicle(null)} />
      </ModalSheet>

      <ModalSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Driver">
        <Pressable style={styles.option} onPress={() => handleAssign(null)}>
          <Text style={styles.optionText}>Unassigned</Text>
        </Pressable>
        {drivers.map((d) => (
          <Pressable key={d.id} style={styles.option} disabled={busy} onPress={() => handleAssign(d.id)}>
            <Text style={styles.optionText}>{d.full_name ?? d.id}</Text>
          </Pressable>
        ))}
        <Btn label="Cancel" variant="ghost" onPress={() => setAssignOpen(false)} />
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  rego: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionText: { color: COLORS.text, fontSize: 15 },
});
