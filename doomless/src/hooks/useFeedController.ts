// Centralized feed logic: surfaces the next card to show and wires up store updates.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { QuizFeedback } from '../components/QuizCard';
import type { Card, FactCard, QuizCard } from '../types/cards';
import type { CategoryId } from '../types/categories';
import { useBrainStore } from '../store/brainStore';
import type { BrainState } from '../store/brainStore';
import type { Fact } from '../types/Fact';
import { defaultContentSeeder } from '../services/DefaultContentSeeder';
import { storageService } from '../services/StorageService';

const QUIZ_INTERVAL = 3;

type UseFeedControllerReturn = {
  currentCard: Card | null;
  isHydrating: boolean;
  quizFeedback: QuizFeedback | null;
  likeCurrent: () => void;
  dislikeCurrent: () => void;
  skipCurrent: () => void;
  answerQuiz: (optionIndex: number) => void;
  resetFeedback: () => void;
  skipQuiz: () => void;
};

type WeightedItem<T extends { category: FactCard['category'] }> = {
  item: T;
  weight: number;
};

const inferDifficulty = (text: string): FactCard['difficulty'] => {
  const length = text.length;
  if (length < 100) {
    return 'easy';
  }
  if (length < 160) {
    return 'medium';
  }
  return 'hard';
};

const mapFactToFactCard = (fact: Fact, categoryLabel: string): FactCard => ({
  id: `fact-${fact.id}`,
  type: 'fact',
  text: fact.content,
  category: fact.topic as CategoryId,
  categoryLabel,
  difficulty: inferDifficulty(fact.content),
});

const mapFactToQuizCard = (fact: Fact, categoryLabel: string): QuizCard | null => {
  if (!fact.quiz_data) {
    return null;
  }
  return {
    id: `quiz-${fact.id}`,
    type: 'quiz',
    question: fact.quiz_data.question,
    options: fact.quiz_data.options,
    correctIndex: fact.quiz_data.correct_answer,
    category: fact.topic as CategoryId,
    categoryLabel,
    relatedFactId: `fact-${fact.id}`,
  };
};

const buildWeightedPool = <T extends { category: FactCard['category'] }>(
  items: T[],
  categoryScores: Record<CategoryId, number>,
): WeightedItem<T>[] =>
  items.map((item) => ({
    item,
    weight: Math.max(0, categoryScores[item.category] ?? 0) + 1,
  }));

const pickByWeight = <T extends { category: FactCard['category'] }>(
  items: WeightedItem<T>[],
): T | null => {
  if (items.length === 0) {
    return null;
  }
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  let target = Math.random() * total;
  for (const entry of items) {
    if (target < entry.weight) {
      return entry.item;
    }
    target -= entry.weight;
  }
  return items[items.length - 1].item;
};

export const useFeedController = (): UseFeedControllerReturn => {
  const profile = useBrainStore((state: BrainState) => state.profile);
  const seenCardIds = useBrainStore((state: BrainState) => state.seenCardIds);
  const hasHydrated = useBrainStore((state: BrainState) => state.hasHydrated);
  const categories = useBrainStore((state: BrainState) => state.categories);
  const contentRevision = useBrainStore((state: BrainState) => state.contentRevision);
  const recordFactInteraction = useBrainStore(
    (state: BrainState) => state.recordFactInteraction,
  );
  const recordQuizResult = useBrainStore(
    (state: BrainState) => state.recordQuizResult,
  );
  const addSeenCard = useBrainStore((state: BrainState) => state.addSeenCard);

  const factsSinceQuiz = useRef(0);
  const isMounted = useRef(true);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<QuizFeedback | null>(null);
  const [factDeck, setFactDeck] = useState<FactCard[]>([]);
  const [quizDeck, setQuizDeck] = useState<QuizCard[]>([]);
  const [isDeckLoading, setIsDeckLoading] = useState(true);

  const enabledCategoryList = useMemo(
    () => categories.filter((category) => category.enabled).map((category) => category.id),
    [categories],
  );
  const categoryLabelById = useMemo(() => {
    const map: Record<CategoryId, string> = {};
    categories.forEach((category) => {
      map[category.id] = category.name;
    });
    return map;
  }, [categories]);
  const enabledCategorySignature = useMemo(
    () => enabledCategoryList.join('|'),
    [enabledCategoryList],
  );
  const enabledCategoryIds = useMemo(
    () => new Set(enabledCategoryList),
    [enabledCategoryList],
  );

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }
    };
  }, []);

  const pickFactCard = useCallback((): FactCard | null => {
    const source = factDeck.filter((card) => enabledCategoryIds.has(card.category));
    if (source.length === 0) {
      return null;
    }
    const unseen = source.filter((card) => !seenCardIds.includes(card.id));
    const pool = unseen.length > 0 ? unseen : source;
    const weightedPool = buildWeightedPool(pool, profile.categoryScores);
    return pickByWeight(weightedPool);
  }, [enabledCategoryIds, factDeck, profile.categoryScores, seenCardIds]);

  const pickQuizCard = useCallback((): QuizCard | null => {
    const source = quizDeck.filter((card) => enabledCategoryIds.has(card.category));
    if (source.length === 0) {
      return null;
    }
    const unseen = source.filter((card) => !seenCardIds.includes(card.id));
    const pool = unseen.length > 0 ? unseen : source;
    return pickByWeight(buildWeightedPool(pool, profile.categoryScores));
  }, [enabledCategoryIds, profile.categoryScores, quizDeck, seenCardIds]);

  const advanceToNextCard = useCallback(
    (forceQuiz = false) => {
      if (!hasHydrated || isDeckLoading) {
        return;
      }
      setQuizFeedback(null);

      const shouldShowQuiz =
        forceQuiz ||
        (factsSinceQuiz.current >= QUIZ_INTERVAL && quizDeck.length > 0);

      let nextCard: Card | null = null;
      if (shouldShowQuiz) {
        nextCard = pickQuizCard();
        if (nextCard) {
          factsSinceQuiz.current = 0;
        }
      }

      if (!nextCard) {
        const factCandidate = pickFactCard();
        if (factCandidate) {
          nextCard = factCandidate;
          factsSinceQuiz.current += 1;
        }
      }

      if (!nextCard) {
        nextCard = pickQuizCard();
        if (nextCard) {
          factsSinceQuiz.current = 0;
        }
      }

      if (nextCard) {
        setCurrentCard(nextCard);
        addSeenCard(nextCard.id);
      } else {
        setCurrentCard(null);
      }
    },
    [addSeenCard, hasHydrated, isDeckLoading, pickFactCard, pickQuizCard, quizDeck.length],
  );

  useEffect(() => {
    if (!hasHydrated || isDeckLoading) {
      return;
    }
    if (currentCard === null) {
      advanceToNextCard();
    }
  }, [advanceToNextCard, currentCard, hasHydrated, isDeckLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadDeck = async () => {
      setIsDeckLoading(true);
      try {
        await defaultContentSeeder.ensureSeeded();
        await storageService.initialize();

        if (enabledCategoryList.length === 0) {
          if (!cancelled) {
            setFactDeck([]);
            setQuizDeck([]);
            factsSinceQuiz.current = 0;
            setCurrentCard(null);
          }
          return;
        }

        const facts = await storageService.getFactsByTopics(enabledCategoryList, {
          includeQuizzes: true,
          limit: 500,
        });

        if (cancelled) {
          return;
        }

        const factCards = facts
          .filter((fact) => !fact.is_quiz)
          .map((fact) =>
            mapFactToFactCard(
              fact,
              categoryLabelById[fact.topic as CategoryId] ?? fact.topic,
            ),
          );
        const quizCards = facts
          .filter((fact) => fact.is_quiz && fact.quiz_data)
          .map((fact) =>
            mapFactToQuizCard(
              fact,
              categoryLabelById[fact.topic as CategoryId] ?? fact.topic,
            ),
          )
          .filter((card): card is QuizCard => card != null);

        setFactDeck(factCards);
        setQuizDeck(quizCards);
        factsSinceQuiz.current = 0;
        setCurrentCard(null);
      } catch (error) {
        if (!cancelled) {
          console.error('[Feed] Failed to load deck:', error);
          setFactDeck([]);
          setQuizDeck([]);
          factsSinceQuiz.current = 0;
          setCurrentCard(null);
        }
      } finally {
        if (!cancelled) {
          setIsDeckLoading(false);
        }
      }
    };

    loadDeck();

    return () => {
      cancelled = true;
    };
  }, [contentRevision, enabledCategorySignature, categoryLabelById]);

  const likeCurrent = useCallback(() => {
    if (!currentCard || currentCard.type !== 'fact') {
      return;
    }
    recordFactInteraction(currentCard.category, 'like');
    advanceToNextCard();
  }, [advanceToNextCard, currentCard, recordFactInteraction]);

  const dislikeCurrent = useCallback(() => {
    if (!currentCard || currentCard.type !== 'fact') {
      return;
    }
    recordFactInteraction(currentCard.category, 'dislike');
    advanceToNextCard();
  }, [advanceToNextCard, currentCard, recordFactInteraction]);

  const skipCurrent = useCallback(() => {
    if (!currentCard || currentCard.type !== 'fact') {
      return;
    }
    recordFactInteraction(currentCard.category, 'skip');
    advanceToNextCard();
  }, [advanceToNextCard, currentCard, recordFactInteraction]);

  const answerQuiz = useCallback(
    (optionIndex: number) => {
      if (!currentCard || currentCard.type !== 'quiz') {
        return;
      }
      const isCorrect = optionIndex === currentCard.correctIndex;
      recordQuizResult(currentCard.category, isCorrect);
      setQuizFeedback({
        correctIndex: currentCard.correctIndex,
        selectedIndex: optionIndex,
        isCorrect,
      });

      if (feedbackTimeout.current) {
        clearTimeout(feedbackTimeout.current);
      }

      feedbackTimeout.current = setTimeout(() => {
        if (!isMounted.current) {
          return;
        }
        feedbackTimeout.current = null;
        advanceToNextCard();
      }, 900);
    },
    [advanceToNextCard, currentCard, recordQuizResult],
  );

  const resetFeedback = useCallback(() => {
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = null;
    }
    setQuizFeedback(null);
  }, []);

  const skipQuiz = useCallback(() => {
    if (!currentCard || currentCard.type !== 'quiz') {
      return;
    }
    if (feedbackTimeout.current) {
      clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = null;
    }
    setQuizFeedback(null);
    advanceToNextCard();
  }, [advanceToNextCard, currentCard]);

  const isHydrating = !hasHydrated || isDeckLoading;

  return {
    currentCard,
    isHydrating,
    quizFeedback,
    likeCurrent,
    dislikeCurrent,
    skipCurrent,
    answerQuiz,
    resetFeedback,
    skipQuiz,
  };
};
