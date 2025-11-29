// Simple horizontal progress indicator used in the Brain screen.
import React from 'react';
import { StyleSheet, View } from 'react-native';

export type ProgressBarProps = {
  value: number; // expected 0..1
};

export const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#34d399',
  },
});
