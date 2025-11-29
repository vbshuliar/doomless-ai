// Presentation component for quiz cards, showing feedback inline.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { QuizCard as QuizCardType } from '../types/cards';

export type QuizFeedback = {
  correctIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
};

export type QuizCardProps = {
  card: QuizCardType;
  onSelect: (index: number) => void;
  feedback: QuizFeedback | null;
  onSkip?: () => void;
};

export const QuizCard: React.FC<QuizCardProps> = ({ card, onSelect, feedback, onSkip }) => {
  const displayCategory = card.categoryLabel ?? card.category;
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.category}>{displayCategory}</Text>
        <View style={styles.headerBadgeRow}>
          <Text style={styles.quizLabel}>QUIZ</Text>
          {onSkip && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onSkip}
              style={styles.skipButton}
              hitSlop={12}
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.question}>{card.question}</Text>
      <View style={styles.optionsWrapper}>
        {card.options.map((option, index) => {
          const isSelected = feedback?.selectedIndex === index;
          const isCorrect = feedback?.correctIndex === index;
          const showCorrect = Boolean(feedback) && isCorrect;
          const showIncorrect = Boolean(feedback) && isSelected && !isCorrect;

          return (
            <TouchableOpacity
              key={option}
              accessibilityRole="button"
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                showCorrect && styles.optionCorrect,
                showIncorrect && styles.optionIncorrect,
              ]}
              onPress={() => onSelect(index)}
              disabled={Boolean(feedback)}
            >
              <Text
                style={[
                  styles.optionText,
                  (showCorrect || showIncorrect) && styles.optionTextHighlighted,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {feedback && (
        <Text style={styles.feedbackLabel}>
          {feedback.isCorrect ? 'Nice! You nailed it.' : 'Good try! Another fact is coming.'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    gap: 16,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  category: {
    fontWeight: '600',
    color: '#a855f7',
    letterSpacing: 1.2,
  },
  quizLabel: {
    fontWeight: '700',
    color: '#6c6f93',
    letterSpacing: 1.2,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#eef2ff',
  },
  skipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.4,
  },
  question: {
    fontSize: 20,
    lineHeight: 28,
    color: '#1f1f1f',
    marginBottom: 12,
  },
  optionsWrapper: {
    gap: 12,
  },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d5dae3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f5f7fa',
  },
  optionSelected: {
    borderColor: '#2f80ed',
  },
  optionCorrect: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  optionIncorrect: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  optionText: {
    fontSize: 16,
    color: '#1f2933',
  },
  optionTextHighlighted: {
    fontWeight: '600',
  },
  feedbackLabel: {
    marginTop: 4,
    textAlign: 'center',
    color: '#4b5563',
    fontSize: 15,
  },
});
