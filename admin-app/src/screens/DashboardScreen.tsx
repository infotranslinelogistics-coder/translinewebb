import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { Card, StatCard, Btn, KV, ModalSheet, Empty, COLORS } from '../components/ui';
import { supabase } from '../lib/supabase';
import { getDashboardStats, getLiveMonitor, type DashboardStats, type LiveMonitor } from '../lib/db/dashboard';
import { countPendingChecklistApprovals } from '../lib/db/checklistApprovals';
import {
  listAdminInboxNotifications,
  acknowledgeMaintenanceItem,
  markMaintenanceItemCompleted,
  type InboxNotification,
} from '../lib/db/maintenance';
import { formatPerthDateTime } from '../lib/dateTime';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monitor, setMonitor] = useState<LiveMonitor | null>(null);
  const [pendingChecklists, setPendingChecklists] = useState(0);
  const [alerts, setAlerts] = useState<InboxNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const [s, m, c, a] = await Promise.all([
        getDashboardStats(),
        getLiveMonitor(),
        countPendingChecklistApprovals().catch(() => 0),
        listAdminInboxNotifications().catch(() => [] as InboxNotification[]),
      ]);
      setStats(s);
      setMonitor(m);
      setPendingChecklists(c);
      setAlerts(a);
    } catch (err) {
      console.error('[Dashboard] load failed', err);
    }
  }, []);

  const loadMonitor = useCallback(async () => {
    try {
      setMonitor(await getLiveMonitor());
    } catch (err) {
      console.error('[Dashboard] monitor refresh failed', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // Realtime monitor: refetch when shifts or admin actions change.
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => void loadMonitor())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_audit_logs' }, () => void loadMonitor())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMonitor]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleAcknowledge = async (id: string) => {
    setBusyId(id);
    try {
      await acknowledgeMaintenanceItem(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('[Dashboard] acknowledge failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setBusyId(id);
    try {
      await markMaintenanceItemCompleted(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('[Dashboard] complete failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const v = (n: number | undefined) => (n == null ? '—' : String(n));

  return (
    <ScreenContainer title="Dashboard" subtitle="Overview of your fleet operations">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {pendingChecklists > 0 ? (
          <Card style={{ borderColor: '#7F1D1D', backgroundColor: '#1f0a0a' }}>
            <Text style={styles.alertText}>
              {pendingChecklists} failed pre-start checklist request(s) need admin review
            </Text>
            <Btn label="Review checklist approvals" small onPress={() => navigation.navigate('ChecklistApprovals')} />
          </Card>
        ) : null}

        {alerts.length > 0 ? (
          <Card style={{ borderColor: '#854d0e', backgroundColor: '#1f1605' }}>
            <Text style={[styles.alertText, { color: COLORS.yellow }]}>
              {alerts.length} open automatic service alert(s)
            </Text>
            <Btn label="View alerts" small variant="secondary" onPress={() => setAlertModalOpen(true)} />
          </Card>
        ) : null}

        <View style={styles.grid}>
          <StatCard label="Total Drivers" value={v(stats?.totalDrivers)} sublabel={`${v(stats?.activeDrivers)} on active shifts`} color={COLORS.blue} />
          <StatCard label="Total Vehicles" value={v(stats?.totalVehicles)} sublabel={`${v(stats?.activeVehicles)} in active shifts`} color={COLORS.purple} />
          <StatCard label="Active Shifts" value={v(stats?.activeShifts)} sublabel={`${v(stats?.todayShifts)} today`} color={COLORS.accent} />
          <StatCard label="Due for Service" value={v(stats?.vehiclesInMaintenance)} sublabel={`${v(stats?.pendingMaintenance)} pending`} color={COLORS.yellow} />
        </View>

        <Text style={styles.heading}>Live Monitor</Text>
        <View style={styles.grid}>
          <StatCard label="Active Shifts Now" value={v(monitor?.activeShiftCount)} color={COLORS.green} />
          <StatCard label="Force-Ended Today" value={v(monitor?.forceEndedToday)} color={COLORS.red} />
          <StatCard label="Admin Actions Today" value={v(monitor?.adminActionsToday)} color={COLORS.blue} />
        </View>

        <Card>
          <Text style={styles.cardHeading}>Fleet Status</Text>
          <KV k="Drivers on Active Shifts" v={`${v(stats?.activeDrivers)} / ${v(stats?.totalDrivers)}`} />
          <KV k="Vehicles in Active Shifts" v={`${v(stats?.activeVehicles)} / ${v(stats?.totalVehicles)}`} />
          <KV k="Shifts Active" v={v(stats?.activeShifts)} />
        </Card>

        <Card>
          <Text style={styles.cardHeading}>Maintenance Queue</Text>
          <KV k="Vehicles in Maintenance" v={v(stats?.vehiclesInMaintenance)} />
          <KV k="Pending Items" v={v(stats?.pendingMaintenance)} />
          <Btn label="Go to Maintenance" small variant="secondary" style={{ marginTop: 8 }} onPress={() => navigation.navigate('Maintenance')} />
        </Card>
      </ScrollView>

      <ModalSheet visible={alertModalOpen} onClose={() => setAlertModalOpen(false)} title="Service Alerts">
        {alerts.length === 0 ? (
          <Empty text="No open service alerts." />
        ) : (
          alerts.map((a) => (
            <Card key={a.id}>
              <KV k="Vehicle" v={a.vehicle_rego ?? a.vehicle_id ?? 'Unknown'} />
              <KV k="Current km" v={a.current_km != null ? `${a.current_km.toLocaleString()} km` : '—'} />
              <KV k="Target service km" v={a.next_service_km != null ? `${a.next_service_km.toLocaleString()} km` : '—'} />
              <KV k="KM remaining" v={a.km_remaining != null ? `${a.km_remaining.toLocaleString()} km` : '—'} />
              <Text style={styles.alertTime}>{formatPerthDateTime(a.created_at)}</Text>
              <View style={styles.alertActions}>
                <Btn label="Acknowledge" small variant="secondary" disabled={busyId === a.id} onPress={() => handleAcknowledge(a.id)} />
                <Btn label="Mark completed" small variant="success" disabled={busyId === a.id} onPress={() => handleComplete(a.id)} />
              </View>
            </Card>
          ))
        )}
        <Btn label="Close" variant="ghost" onPress={() => setAlertModalOpen(false)} />
      </ModalSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  heading: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  cardHeading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  alertText: { color: COLORS.red, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  alertTime: { color: COLORS.subtle, fontSize: 11, marginTop: 6 },
  alertActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
