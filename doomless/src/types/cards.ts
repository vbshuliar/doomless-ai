// Core content types for CurioSwipe cards and categories.
import type { CategoryId } from './categories';

export type FactDifficulty = 'easy' | 'medium' | 'hard';

export type FactCard = {
  id: string;
  type: 'fact';
  text: string;
  category: CategoryId;
  categoryLabel?: string;
  difficulty: FactDifficulty;
};

export type QuizCard = {
  id: string;
  type: 'quiz';
  question: string;
  options: string[];
  correctIndex: number;
  category: CategoryId;
  categoryLabel?: string;
  relatedFactId?: string;
};

export type Card = FactCard | QuizCard;
