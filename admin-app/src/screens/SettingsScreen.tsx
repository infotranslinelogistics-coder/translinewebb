import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenContainer from '../components/ScreenContainer';
import { Card, Badge, Btn, Field, KV, COLORS } from '../components/ui';
import { useAuth } from '../state/AuthContext';
import { supabase } from '../lib/supabase';
import { isAdminApiConfigured } from '../lib/api/admin';

const PREFS_KEY = 'transline.notificationPrefs';

const EMAIL_PREFS = [
  { key: 'maintenanceDue', label: 'Vehicle maintenance due' },
  { key: 'incidentReports', label: 'Driver incident reports' },
  { key: 'systemAlerts', label: 'System alerts' },
  { key: 'dailySummary', label: 'Daily summary reports' },
];
const PUSH_PREFS = [
  { key: 'criticalAlerts', label: 'Critical alerts' },
  { key: 'newDriverLogs', label: 'New driver logs' },
  { key: 'shiftStartEnd', label: 'Shift start/end' },
  { key: 'maintenanceOverdue', label: 'Maintenance overdue' },
];

const DEFAULT_PREFS: Record<string, boolean> = {
  maintenanceDue: true,
  incidentReports: true,
  systemAlerts: true,
  dailySummary: true,
  criticalAlerts: true,
  newDriverLogs: false,
  shiftStartEnd: false,
  maintenanceOverdue: false,
};

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data, error }) => setSupabaseStatus(error || !data?.user ? 'disconnected' : 'connected'))
      .catch(() => setSupabaseStatus('disconnected'));

    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!current || !next || !confirm) {
      setPwMsg({ ok: false, text: 'All fields are required.' });
      return;
    }
    if (next.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    if (next === current) {
      setPwMsg({ ok: false, text: 'New password must differ from current.' });
      return;
    }
    if (!user?.email) {
      setPwMsg({ ok: false, text: 'No signed-in email.' });
      return;
    }
    setPwBusy(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (reauthError) {
        setPwMsg({ ok: false, text: 'Current password is incorrect.' });
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setPwMsg({ ok: false, text: updateError.message });
        return;
      }
      setPwMsg({ ok: true, text: 'Password updated.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to update password.' });
    } finally {
      setPwBusy(false);
    }
  };

  const savePrefs = async () => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  return (
    <ScreenContainer title="Settings">
      <ScrollView>
        <Card>
          <Text style={styles.heading}>Admin Profile</Text>
          <KV k="Email" v={user?.email ?? '—'} />
          <KV k="Role" v="Administrator" />
          <View style={{ height: 8 }} />
          <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
          <Field label="New password" value={next} onChangeText={setNext} secureTextEntry />
          <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          {pwMsg ? <Text style={[styles.msg, { color: pwMsg.ok ? COLORS.green : COLORS.red }]}>{pwMsg.text}</Text> : null}
          <Btn label={pwBusy ? 'Updating…' : 'Update Password'} disabled={pwBusy} onPress={handleChangePassword} />
        </Card>

        <Card>
          <Text style={styles.heading}>System Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Supabase</Text>
            <Badge
              label={supabaseStatus === 'checking' ? 'Checking…' : supabaseStatus === 'connected' ? 'Connected' : 'Not Connected'}
              variant={supabaseStatus === 'connected' ? 'green' : supabaseStatus === 'checking' ? 'gray' : 'red'}
            />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Admin API</Text>
            <Badge label={isAdminApiConfigured ? 'Configured' : 'Not Configured'} variant={isAdminApiConfigured ? 'green' : 'yellow'} />
          </View>
        </Card>

        <Card>
          <Text style={styles.heading}>Email Notifications</Text>
          {EMAIL_PREFS.map((p) => (
            <View key={p.key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{p.label}</Text>
              <Switch value={prefs[p.key]} onValueChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))} trackColor={{ true: COLORS.accent, false: COLORS.border }} />
            </View>
          ))}
          <Text style={[styles.heading, { marginTop: 12 }]}>Push Notifications</Text>
          {PUSH_PREFS.map((p) => (
            <View key={p.key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{p.label}</Text>
              <Switch value={prefs[p.key]} onValueChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))} trackColor={{ true: COLORS.accent, false: COLORS.border }} />
            </View>
          ))}
          {prefsSaved ? <Text style={[styles.msg, { color: COLORS.green }]}>Preferences saved.</Text> : null}
          <Btn label="Save Preferences" variant="secondary" onPress={savePrefs} />
        </Card>

        <Btn label="Sign out" variant="danger" onPress={signOut} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  msg: { fontSize: 12, marginBottom: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statusLabel: { color: COLORS.muted, fontSize: 13 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  prefLabel: { color: COLORS.muted, fontSize: 13, flexShrink: 1 },
});
