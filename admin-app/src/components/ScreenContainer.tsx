import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface ScreenContainerProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function ScreenContainer({ title, subtitle, children }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0B0B' },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },
});
