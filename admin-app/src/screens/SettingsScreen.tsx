import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../state/AuthContext';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScreenContainer title="Settings">
      <View style={styles.row}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
      </View>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  label: { color: '#9CA3AF', fontSize: 13 },
  value: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  signOutButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
