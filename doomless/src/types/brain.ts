// Shapes for the local personalization profile stored on-device.
import type { CategoryId } from './categories';

export type BrainProfile = {
  categoryScores: Record<CategoryId, number>;
  factsSeen: number;
  likes: number;
  dislikes: number;
  skips: number;
  quizzesAnswered: number;
  quizzesCorrect: number;
};

export const buildInitialBrainProfile = (
  categoryIds: CategoryId[],
): BrainProfile => {
  const categoryScores: Record<CategoryId, number> = {};
  categoryIds.forEach((id) => {
    categoryScores[id] = 0;
  });

  return {
    categoryScores,
    factsSeen: 0,
    likes: 0,
    dislikes: 0,
    skips: 0,
    quizzesAnswered: 0,
    quizzesCorrect: 0,
  };
};
