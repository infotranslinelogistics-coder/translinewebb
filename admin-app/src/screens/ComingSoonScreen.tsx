import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';

export default function ComingSoonScreen({ title }: { title: string }) {
  return (
    <ScreenContainer title={title}>
      <Text style={styles.text}>This screen is coming soon.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  text: { color: '#9CA3AF', fontSize: 14 },
});
