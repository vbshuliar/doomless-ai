// Convenience hook for reading the brain profile and hydration status in components.
import { useMemo } from 'react';

import { useBrainStore } from '../store/brainStore';
import type { BrainState } from '../store/brainStore';

export const useBrainProfile = () =>
  useBrainStore((state: BrainState) => state.profile);

export const useBrainHydration = () =>
  useBrainStore((state: BrainState) => state.hasHydrated);

export const useCategories = () =>
  useBrainStore((state: BrainState) => state.categories);

export const useBrainStats = () => {
  const profile = useBrainProfile();
  return useMemo(() => {
    const { quizzesAnswered, quizzesCorrect } = profile;
    const accuracy = quizzesAnswered
      ? Math.round((quizzesCorrect / quizzesAnswered) * 100)
      : 0;
    return {
      ...profile,
      quizAccuracy: accuracy,
    };
  }, [profile]);
};
