// Presentation component for fact cards in the feed.
// Handles tap vs double tap to expand/collapse without owning swipe gestures.
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FactCard as FactCardType } from '../types/cards';

export type FactCardProps = {
  card: FactCardType;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
};

const DOUBLE_TAP_WINDOW = 260;

export const FactCard: React.FC<FactCardProps> = ({
  card,
  isExpanded,
  onExpand,
  onCollapse,
}) => {
  const lastTapRef = useRef<number | null>(null);
  const displayCategory = card.categoryLabel ?? card.category;

  useEffect(() => {
    if (!isExpanded) {
      lastTapRef.current = null;
    }
  }, [isExpanded]);

  const handlePress = () => {
    const now = Date.now();

    // Single tap expands, a second tap within the window collapses when expanded.
    if (isExpanded) {
      if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_WINDOW) {
        lastTapRef.current = null;
        onCollapse();
      } else {
        lastTapRef.current = now;
      }
      return;
    }

    lastTapRef.current = now;
    onExpand();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      hitSlop={12}
      style={({ pressed }) => [styles.pressable, pressed && !isExpanded && styles.pressablePressed]}
    >
      <View style={[styles.container, isExpanded && styles.containerExpanded]}>
        <View style={styles.headerRow}>
          <Text style={styles.category}>{displayCategory}</Text>
          <Text style={styles.difficulty}>{card.difficulty.toUpperCase()}</Text>
        </View>

        {isExpanded ? (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text style={[styles.text, styles.textExpanded]}>{card.text}</Text>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Why it sticks</Text>
              <Text style={styles.calloutBody}>
                Swiping right builds a smarter feed around {displayCategory} curiosities. Swiping left
                tells the brain coach to remix your next discoveries.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.bodyCompact}>
            <Text numberOfLines={6} style={[styles.text, styles.textCompact]}>
              {card.text}
            </Text>
          </View>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.footerHint}>
            {isExpanded ? 'Double tap to collapse' : 'Tap to expand • Swipe left/right to react'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 24,
    flex: 1,
    height: '100%',
  },
  pressablePressed: {
    opacity: 0.92,
  },
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#cbd5f5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    marginHorizontal: 16,
    justifyContent: 'space-between',
  },
  containerExpanded: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 28,
    backgroundColor: '#f8fafc',
    borderColor: '#94a3f3',
    borderRadius: 24,
    marginHorizontal: 0,
    height: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 1.3,
  },
  difficulty: {
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 1.1,
  },
  text: {
    fontSize: 18,
    lineHeight: 28,
    color: '#0f172a',
  },
  textExpanded: {
    fontSize: 20,
    lineHeight: 30,
  },
  textCompact: {
    textAlign: 'center',
  },
  bodyCompact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: '100%',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 36,
  },
  callout: {
    backgroundColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  calloutTitle: {
    fontWeight: '700',
    color: '#1e293b',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  calloutBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerHint: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 0.3,
  },
});
