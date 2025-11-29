// Brain screen visualizes the local personalization profile and simple stats.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '../components/ProgressBar';
import { useBrainStats } from '../hooks/useBrainProfile';
import type { Category } from '../types/cards';

const categories: Category[] = ['science', 'history', 'psychology', 'literature', 'random'];
const SCORE_WINDOW = 10; // used to normalize category scores into a 0..1 range.

const normalizeScore = (score: number) => {
  const normalized = (score + SCORE_WINDOW) / (SCORE_WINDOW * 2);
  return Math.max(0, Math.min(1, normalized));
};

export const BrainScreen: React.FC = () => {
  const stats = useBrainStats();

  const totals = useMemo(
    () => [
      { label: 'Fact cards seen', value: stats.factsSeen },
      { label: 'Likes', value: stats.likes },
      { label: 'Dislikes', value: stats.dislikes },
      { label: 'Skips', value: stats.skips },
      { label: 'Quiz answers', value: stats.quizzesAnswered },
      { label: 'Quiz accuracy', value: `${stats.quizAccuracy}%` },
    ],
    [stats],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Brain</Text>
        <Text style={styles.subtitle}>
          Category points grow as you like and master cards. We keep everything on this device.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Focus</Text>
          {categories.map((category) => {
            const score = stats.categoryScores[category] ?? 0;
            return (
              <View key={category} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryLabel}>{category.toUpperCase()}</Text>
                  <Text style={styles.categoryScore}>{score}</Text>
                </View>
                <ProgressBar value={normalizeScore(score)} />
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Stats</Text>
          {totals.map((item) => (
            <View key={item.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 64,
    gap: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
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
    gap: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  categoryRow: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    letterSpacing: 1.1,
  },
  categoryScore: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 16,
    color: '#475569',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});
