import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { fetchShiftWithEvents, forceEndShift, type ShiftEvent, type ShiftFull } from '../lib/db/shifts';
import type { DrawerParamList } from '../types/navigation';

function formatChecklistLabel(key: string) {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function eventLabel(eventType: string) {
  switch (eventType) {
    case 'shift_start':
      return 'Shift started';
    case 'shift_end':
      return 'Shift ended';
    case 'break_start':
      return 'Break started';
    case 'break_end':
      return 'Break ended';
    case 'location':
      return 'Location update';
    default:
      return formatChecklistLabel(eventType);
  }
}

export default function ShiftDetailScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'ShiftDetail'>>();
  const { shiftId } = route.params;
  const [shift, setShift] = useState<ShiftFull | null>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

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

  const handleForceEnd = () => {
    Alert.alert('Force End Shift', 'This will immediately end the active shift. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Force End',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          try {
            await forceEndShift(shiftId);
            await load();
          } catch (err) {
            console.error('[ShiftDetail] force end failed', err);
            Alert.alert('Error', 'Failed to end shift.');
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer title="Shift">
        <ActivityIndicator color="#FF6B35" />
      </ScreenContainer>
    );
  }

  if (!shift) {
    return (
      <ScreenContainer title="Shift">
        <Text style={styles.value}>Shift not found.</Text>
      </ScreenContainer>
    );
  }

  const checklistEntries = Object.entries(shift.checklist ?? {});

  return (
    <ScreenContainer title={shift.driver_name ?? 'Shift'} subtitle={shift.vehicle_rego ?? undefined}>
      <ScrollView>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{shift.status ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Started</Text>
          <Text style={styles.value}>{shift.started_at ? new Date(shift.started_at).toLocaleString() : '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ended</Text>
          <Text style={styles.value}>{shift.ended_at ? new Date(shift.ended_at).toLocaleString() : '—'}</Text>
        </View>

        {shift.status === 'active' ? (
          <TouchableOpacity style={styles.endButton} onPress={handleForceEnd} disabled={ending}>
            <Text style={styles.endButtonText}>{ending ? 'Ending...' : 'Force End Shift'}</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Checklist</Text>
        {checklistEntries.length === 0 ? (
          <Text style={styles.empty}>No checklist submitted.</Text>
        ) : (
          checklistEntries.map(([key, value]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{formatChecklistLabel(key)}</Text>
              <Text style={[styles.value, value === 'fail' && styles.fail]}>{value ?? 'pending'}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Events</Text>
        {events.length === 0 ? (
          <Text style={styles.empty}>No events recorded.</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventLabel}>{eventLabel(event.event_type)}</Text>
              <Text style={styles.eventTime}>{new Date(event.created_at).toLocaleString()}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: '#262626',
    borderBottomWidth: 1,
  },
  label: { color: '#9CA3AF', fontSize: 13 },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  fail: { color: '#F87171' },
  empty: { color: '#9CA3AF', fontSize: 13, marginTop: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  endButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  endButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  eventRow: {
    backgroundColor: '#161616',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  eventLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  eventTime: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
});
