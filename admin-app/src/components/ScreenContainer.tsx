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
  safeArea: { flex: 1, backgroundColor: '#F5F2EB' },
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#17191B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: '#686B6F', marginBottom: 16 },
});
