// Settings screen provides a reset button and communicates upcoming AI features.
import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrainStore } from '../store/brainStore';
import type { BrainState } from '../store/brainStore';

export const SettingsScreen: React.FC = () => {
  const resetAll = useBrainStore((state: BrainState) => state.resetAll);

  const handleReset = () => {
    Alert.alert(
      'Reset CurioSwipe',
      'This will clear your local progress and preferences. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAll();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Controls</Text>
          <Text style={styles.sectionBody}>
            Everything lives on this device. Reset whenever you want a fresh curiosity journey.
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonLabel}>Reset Local Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.sectionBody}>
            On-device AI via the Cactus SDK will personalize facts, remix quizzes, and let you chat with characters from your own PDFs—without leaving airplane mode.
          </Text>
          <Text style={styles.sectionBody}>
            We will also add optional PDF ingestion and retrieval-augmented generation backed by local embeddings (think Qwen3-Embedding-0.6B) so your brain feed adapts to your library.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    gap: 24,
  },
  section: {
    backgroundColor: '#fdfdfd',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#cbd5f5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionBody: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  resetButton: {
    marginTop: 12,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 4,
  },
  resetButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
