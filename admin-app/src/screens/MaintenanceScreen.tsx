import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Badge, Btn, Field, KV, ModalSheet, Loader, Empty, COLORS } from '../components/ui';
import {
  listMaintenanceItems,
  listServiceAlerts,
  createMaintenanceItem,
  updateMaintenanceItem,
  deleteMaintenanceItem,
  markMaintenanceItemCompleted,
  normalizeMaintenanceStatus,
  type MaintenanceItem,
  type ServiceAlert,
} from '../lib/db/maintenance';
import { listVehicles, type Vehicle } from '../lib/db/vehicles';
import { listDriverOptions } from '../lib/db/drivers';
import { formatPerthDate } from '../lib/dateTime';

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MaintenanceScreen() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fVehicle, setFVehicle] = useState<string | null>(null);
  const [fDriver, setFDriver] = useState<string | null>(null);
  const [fType, setFType] = useState('');
  const [fDate, setFDate] = useState(todayISODate());
  const [fStatus, setFStatus] = useState('due');

  const load = useCallback(async () => {
    try {
      const [it, al, v, d] = await Promise.all([
        listMaintenanceItems(),
        listServiceAlerts().catch(() => [] as ServiceAlert[]),
        listVehicles().catch(() => [] as Vehicle[]),
        listDriverOptions().catch(() => []),
      ]);
      setItems(it);
      setAlerts(al);
      setVehicles(v);
      setDrivers(d);
    } catch (err) {
      console.error('[Maintenance] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vehMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const drvMap = useMemo(() => new Map(drivers.map((d) => [d.id, d.full_name])), [drivers]);
  const vehLabel = (id: string | null | undefined) => {
    if (!id) return '—';
    const v = vehMap.get(id);
    if (!v) return id.slice(0, 8);
    const mm = [v.make, v.model].filter(Boolean).join(' ');
    return mm ? `${v.rego} • ${mm}` : v.rego;
  };

  const stats = useMemo(() => {
    let due = 0;
    let passed = 0;
    let done = 0;
    items.forEach((i) => {
      const n = normalizeMaintenanceStatus(i.status);
      if (n === 'due') due += 1;
      else if (n === 'passed') passed += 1;
      else done += 1;
    });
    return { due, passed, done, total: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const v = vehMap.get(i.vehicle_id);
      return [i.service_type, v?.rego, v?.make, v?.model, i.driver_id ? drvMap.get(i.driver_id) : '']
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, vehMap, drvMap]);

  const openCreate = () => {
    setEditing(null);
    setFVehicle(null);
    setFDriver(null);
    setFType('');
    setFDate(todayISODate());
    setFStatus('due');
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: MaintenanceItem) => {
    setEditing(item);
    setFVehicle(item.vehicle_id);
    setFDriver(item.driver_id ?? null);
    setFType(item.service_type);
    setFDate((item.scheduled_date ?? item.service_date ?? '').slice(0, 10) || todayISODate());
    setFStatus(normalizeMaintenanceStatus(item.status));
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!fVehicle || !fType.trim() || !fDate.trim()) {
      setFormError('Vehicle, service type and date are required.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateMaintenanceItem(editing.id, {
          vehicle_id: fVehicle,
          driver_id: fDriver,
          service_type: fType.trim(),
          service_date: `${fDate}T00:00:00Z`,
          scheduled_date: `${fDate}T00:00:00Z`,
          status: fStatus,
        });
      } else {
        await createMaintenanceItem({ vehicle_id: fVehicle, driver_id: fDriver, service_type: fType.trim(), date: fDate, status: fStatus });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (item: MaintenanceItem) => {
    Alert.alert('Delete', 'Delete this maintenance record? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteMaintenanceItem(item.id);
            await load();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const handleToggleCompleted = async (item: MaintenanceItem) => {
    setBusyId(item.id);
    try {
      const n = normalizeMaintenanceStatus(item.status);
      if (n === 'done') await updateMaintenanceItem(item.id, { status: 'due' });
      else await updateMaintenanceItem(item.id, { status: 'done' });
      await load();
    } catch (err) {
      Alert.alert('Error', 'Failed to update.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAlertComplete = async (alert: ServiceAlert) => {
    if (!alert.maintenance_item_id) return;
    setBusyId(alert.maintenance_item_id);
    try {
      await markMaintenanceItemCompleted(alert.maintenance_item_id);
      setAlerts((prev) => prev.filter((a) => a.maintenance_item_id !== alert.maintenance_item_id));
      await load();
    } catch (err) {
      Alert.alert('Error', 'Failed to complete.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenContainer title="Maintenance" subtitle="Service schedule & alerts">
      {loading ? (
        <Loader />
      ) : (
        <ScrollView>
          <View style={styles.statRow}>
            <StatCard label="Due" value={stats.due} color={COLORS.yellow} />
            <StatCard label="Passed" value={stats.passed} color={COLORS.red} />
            <StatCard label="Done" value={stats.done} color={COLORS.green} />
            <StatCard label="Total" value={stats.total} color={COLORS.blue} />
          </View>

          {alerts.length > 0 ? (
            <Card style={{ borderColor: '#854d0e' }}>
              <Text style={styles.heading}>Automatic Service Alerts</Text>
              {alerts.map((a, i) => (
                <View key={a.maintenance_item_id ?? i} style={styles.alertRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertVeh}>{a.vehicle_rego ?? a.vehicle_id ?? 'Unknown'}</Text>
                    <Text style={styles.alertSub}>
                      {a.current_km != null ? `${a.current_km.toLocaleString()} km` : '—'} → {a.next_service_km != null ? `${a.next_service_km.toLocaleString()} km` : '—'}
                      {a.km_remaining != null ? ` · ${a.km_remaining.toLocaleString()} km left` : ''}
                    </Text>
                  </View>
                  <Btn label="Complete" small variant="success" disabled={busyId === a.maintenance_item_id} onPress={() => handleAlertComplete(a)} />
                </View>
              ))}
            </Card>
          ) : null}

          <View style={styles.toolbar}>
            <Field placeholder="Search service, vehicle, driver…" value={search} onChangeText={setSearch} style={{ flex: 1, marginBottom: 0 }} />
            <Btn label="+ Add" small onPress={openCreate} />
          </View>

          {filtered.length === 0 ? (
            <Empty text="No maintenance items." />
          ) : (
            filtered.map((item) => {
              const n = normalizeMaintenanceStatus(item.status);
              const busyRow = busyId === item.id;
              return (
                <Card key={item.id}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>{item.service_type}</Text>
                    <Badge label={n} variant={n === 'done' ? 'green' : n === 'passed' ? 'red' : 'yellow'} />
                  </View>
                  <KV k="Vehicle" v={vehLabel(item.vehicle_id)} />
                  {item.driver_id ? <KV k="Driver" v={drvMap.get(item.driver_id) ?? '—'} /> : null}
                  <KV k="Date" v={formatPerthDate(item.scheduled_date ?? item.service_date)} />
                  <View style={styles.actions}>
                    <Btn label="Edit" small variant="secondary" onPress={() => openEdit(item)} />
                    <Btn label={n === 'done' ? 'Mark Uncompleted' : 'Mark Completed'} small variant={n === 'done' ? 'secondary' : 'success'} disabled={busyRow} onPress={() => handleToggleCompleted(item)} />
                    <Btn label={busyRow ? '…' : 'Delete'} small variant="danger" disabled={busyRow} onPress={() => handleDelete(item)} />
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add/Edit */}
      <ModalSheet visible={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Service' : 'Add Service'}>
        <Btn label={`Vehicle: ${fVehicle ? vehLabel(fVehicle) : 'Select'}`} small variant="secondary" onPress={() => setVehiclePickerOpen(true)} />
        <View style={{ height: 8 }} />
        <Btn label={`Driver: ${fDriver ? drvMap.get(fDriver) ?? 'Driver' : 'No driver'}`} small variant="secondary" onPress={() => setDriverPickerOpen(true)} />
        <View style={{ height: 8 }} />
        <Field label="Type of service" value={fType} onChangeText={setFType} placeholder="Scheduled Service" />
        <Field label="Date (YYYY-MM-DD)" value={fDate} onChangeText={setFDate} placeholder="2026-06-28" />
        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.statusPicker}>
          {(['due', 'passed', 'done'] as const).map((s) => (
            <Pressable key={s} onPress={() => setFStatus(s)} style={[styles.statusOpt, fStatus === s && styles.statusOptActive]}>
              <Text style={[styles.statusOptText, fStatus === s && { color: '#fff' }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Btn label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={handleSave} />
        <Btn label="Cancel" variant="ghost" onPress={() => setFormOpen(false)} />
      </ModalSheet>

      <ModalSheet visible={vehiclePickerOpen} onClose={() => setVehiclePickerOpen(false)} title="Select Vehicle">
        {vehicles.map((v) => (
          <Pressable key={v.id} style={styles.option} onPress={() => { setFVehicle(v.id); setVehiclePickerOpen(false); }}>
            <Text style={styles.optionText}>{vehLabel(v.id)}</Text>
          </Pressable>
        ))}
      </ModalSheet>

      <ModalSheet visible={driverPickerOpen} onClose={() => setDriverPickerOpen(false)} title="Select Driver">
        <Pressable style={styles.option} onPress={() => { setFDriver(null); setDriverPickerOpen(false); }}>
          <Text style={styles.optionText}>No driver</Text>
        </Pressable>
        {drivers.map((d) => (
          <Pressable key={d.id} style={styles.option} onPress={() => { setFDriver(d.id); setDriverPickerOpen(false); }}>
            <Text style={styles.optionText}>{d.full_name ?? d.id}</Text>
          </Pressable>
        ))}
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { color: COLORS.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  alertVeh: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  alertSub: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  error: { color: COLORS.red, fontSize: 12, marginBottom: 8 },
  fieldLabel: { color: COLORS.muted, fontSize: 12, marginBottom: 4 },
  statusPicker: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusOpt: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: COLORS.border },
  statusOptActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  statusOptText: { color: COLORS.muted, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionText: { color: COLORS.text, fontSize: 15 },
});
