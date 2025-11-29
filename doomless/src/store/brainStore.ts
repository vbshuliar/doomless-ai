// Zustand store that holds the on-device personalization state for CurioSwipe.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  CategoryKind,
  MAX_ENABLED_CATEGORIES,
  DEFAULT_CATEGORY_DEFINITIONS,
  type CategoryDefinition,
  type CategoryId,
} from '../types/categories';
import type { BrainProfile } from '../types/brain';
import { buildInitialBrainProfile } from '../types/brain';

const STORAGE_KEY = 'curioswipe-brain-store';

type FactAction = 'like' | 'dislike' | 'skip';

type ImportedCategoryInput = {
  name: string;
  sourceFileUri: string;
  sourceFileType: NonNullable<CategoryDefinition['sourceFileType']>;
  createdAt?: number;
};

export type ImportCategoryResult = {
  success: boolean;
  enabled: boolean;
  reason?: string;
};

export type ToggleCategoryResult = {
  success: boolean;
  reason?: string;
};

const cloneProfile = (profile: BrainProfile): BrainProfile => ({
  ...profile,
  categoryScores: { ...profile.categoryScores },
});

const cloneCategories = (categories?: CategoryDefinition[]): CategoryDefinition[] => {
  const source = categories && categories.length > 0 ? categories : createDefaultCategories();
  return source.map((category) => ({ ...category }));
};

const createDefaultCategories = (): CategoryDefinition[] =>
  DEFAULT_CATEGORY_DEFINITIONS.map((category) => ({ ...category }));

const generateCategoryId = (): CategoryId =>
  `imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getEnabledCount = (categories: CategoryDefinition[]): number =>
  categories.filter((category) => category.enabled).length;

const mergeWithDefaultCategories = (
  categories?: CategoryDefinition[],
): CategoryDefinition[] => {
  const current = new Map<string, CategoryDefinition>();
  (categories ?? []).forEach((category) => {
    current.set(category.id, { ...category });
  });

  // Ensure every default category exists and keeps its default metadata except the enabled flag.
  const defaults = DEFAULT_CATEGORY_DEFINITIONS.map((definition) => {
    const existing = current.get(definition.id);
    return {
      ...definition,
      enabled: existing?.enabled ?? definition.enabled,
    } satisfies CategoryDefinition;
  });

  const imported = (categories ?? [])
    .filter((category) => category.kind === CategoryKind.Imported)
    .map((category) => ({ ...category }));

  return [...defaults, ...imported];
};

const syncProfileWithCategories = (
  profile: BrainProfile,
  categories: CategoryDefinition[],
): BrainProfile => {
  const next = cloneProfile(profile);
  const categoryIds = new Set(categories.map((category) => category.id));

  categories.forEach((category) => {
    if (next.categoryScores[category.id] == null) {
      next.categoryScores[category.id] = 0;
    }
  });

  Object.keys(next.categoryScores).forEach((id) => {
    if (!categoryIds.has(id)) {
      delete next.categoryScores[id];
    }
  });

  return next;
};

const ensureScoreKey = (profile: BrainProfile, categoryId: CategoryId) => {
  if (profile.categoryScores[categoryId] == null) {
    profile.categoryScores[categoryId] = 0;
  }
};

const createInitialProfile = () =>
  buildInitialBrainProfile(DEFAULT_CATEGORY_DEFINITIONS.map((category) => category.id));

export type BrainState = {
  profile: BrainProfile;
  categories: CategoryDefinition[];
  seenCardIds: string[];
  hasHydrated: boolean;
  recordFactInteraction: (category: CategoryId, action: FactAction) => void;
  recordQuizResult: (category: CategoryId, correct: boolean) => void;
  addSeenCard: (id: string) => void;
  clearSeenCards: () => void;
  resetAll: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
  ensureDefaultCategories: () => void;
  importCategory: (input: ImportedCategoryInput) => ImportCategoryResult;
  toggleCategoryEnabled: (id: CategoryId, enabled: boolean) => ToggleCategoryResult;
  renameCategory: (id: CategoryId, name: string) => void;
  deleteCategory: (id: CategoryId) => void;
};

export const useBrainStore = create<BrainState>()(
  persist(
    (
      set: (
        partial:
          | Partial<BrainState>
          | ((state: BrainState) => Partial<BrainState> | void),
        replace?: boolean,
      ) => void,
      get: () => BrainState,
    ) => ({
      profile: createInitialProfile(),
      categories: createDefaultCategories(),
      seenCardIds: [],
      hasHydrated: false,
      recordFactInteraction: (category: CategoryId, action: FactAction) => {
        set((state) => {
          const profile = cloneProfile(state.profile);
          ensureScoreKey(profile, category);

          profile.factsSeen += 1;
          if (action === 'like') {
            profile.likes += 1;
            profile.categoryScores[category] += 1;
          }
          if (action === 'dislike') {
            profile.dislikes += 1;
            profile.categoryScores[category] -= 1;
          }
          if (action === 'skip') {
            profile.skips += 1;
          }
          return { profile };
        });
      },
      recordQuizResult: (category: CategoryId, correct: boolean) => {
        set((state) => {
          const profile = cloneProfile(state.profile);
          ensureScoreKey(profile, category);
          profile.quizzesAnswered += 1;
          if (correct) {
            profile.quizzesCorrect += 1;
            profile.categoryScores[category] += 1;
          } else {
            profile.categoryScores[category] -= 1;
          }
          return { profile };
        });
      },
      addSeenCard: (id: string) => {
        set((state) => {
          if (state.seenCardIds.includes(id)) {
            return {};
          }
          const next = [...state.seenCardIds, id];
          const truncated = next.length > 200 ? next.slice(next.length - 200) : next;
          return { seenCardIds: truncated };
        });
      },
      clearSeenCards: () => set({ seenCardIds: [] }),
      resetAll: async () => {
        const categories = createDefaultCategories();
        const profile = buildInitialBrainProfile(categories.map((category) => category.id));
        set({ profile, categories, seenCardIds: [] });
        try {
          await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          console.warn('Failed to clear stored brain data', error);
        }
      },
      setHasHydrated: (value: boolean) => set({ hasHydrated: value }),
      ensureDefaultCategories: () => {
        set((state) => {
          const categories = mergeWithDefaultCategories(state.categories);
          const profile = syncProfileWithCategories(state.profile, categories);
          return { categories, profile };
        });
      },
      importCategory: (input: ImportedCategoryInput) => {
        let result: ImportCategoryResult = { success: false, enabled: false };
        set((state) => {
          const categories = cloneCategories(state.categories);
          const enabledCount = getEnabledCount(categories);
          // Newly imported files auto-enable unless the five-category ceiling is already hit.
          const shouldEnable = enabledCount < MAX_ENABLED_CATEGORIES;
          const newCategory: CategoryDefinition = {
            id: generateCategoryId(),
            name: input.name,
            kind: CategoryKind.Imported,
            enabled: shouldEnable,
            sourceFileUri: input.sourceFileUri,
            sourceFileType: input.sourceFileType,
            createdAt: input.createdAt ?? Date.now(),
          };

          const nextCategories = [...categories, newCategory];
          const profile = syncProfileWithCategories(state.profile, nextCategories);

          result = {
            success: true,
            enabled: shouldEnable,
            reason: shouldEnable
              ? undefined
              : `You can only have ${MAX_ENABLED_CATEGORIES} active categories.`,
          };

          return { categories: nextCategories, profile };
        });
        return result;
      },
      toggleCategoryEnabled: (id: CategoryId, enabled: boolean) => {
        let result: ToggleCategoryResult = { success: false };
        set((state) => {
          const categories = cloneCategories(state.categories);
          const index = categories.findIndex((category) => category.id === id);
          if (index === -1) {
            result = { success: false, reason: 'Category not found.' };
            return {};
          }

          const category = categories[index];
          if (category.enabled === enabled) {
            result = { success: true };
            return {};
          }

          if (enabled) {
            // Enforce the "max five enabled" rule so feed weighting stays predictable
            // until the LLM-powered ingestion flow adds dynamic content.
            const enabledCount = getEnabledCount(categories);
            if (enabledCount >= MAX_ENABLED_CATEGORIES) {
              result = {
                success: false,
                reason: `You can only have ${MAX_ENABLED_CATEGORIES} active categories.`,
              };
              return {};
            }
          }

          categories[index] = { ...category, enabled };
          const profile = syncProfileWithCategories(state.profile, categories);
          result = { success: true };
          return { categories, profile };
        });
        return result;
      },
      renameCategory: (id: CategoryId, name: string) => {
        set((state) => {
          const categories = cloneCategories(state.categories);
          const index = categories.findIndex((category) => category.id === id);
          if (index === -1) {
            return {};
          }
          const category = categories[index];
          if (category.kind === CategoryKind.Default) {
            return {};
          }
          categories[index] = { ...category, name: name.trim() || category.name };
          return { categories };
        });
      },
      deleteCategory: (id: CategoryId) => {
        set((state) => {
          const categories = cloneCategories(state.categories);
          const index = categories.findIndex((category) => category.id === id);
          if (index === -1) {
            return {};
          }
          const category = categories[index];
          if (category.kind === CategoryKind.Default) {
            return {};
          }
          categories.splice(index, 1);

          const profile = cloneProfile(state.profile);
          delete profile.categoryScores[id];
          return { categories, profile };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state: BrainState) => ({
        profile: state.profile,
        seenCardIds: state.seenCardIds,
        categories: state.categories,
      }),
      onRehydrateStorage: () => (state: BrainState | undefined, error?: unknown) => {
        if (error) {
          console.warn('CurioSwipe brain store failed to rehydrate', error);
        }
        state?.ensureDefaultCategories();
        state?.setHasHydrated(true);
      },
    },
  ),
);

export const selectBrainProfile = () => useBrainStore.getState().profile;
export const selectCategories = () => useBrainStore.getState().categories;
export const selectEnabledCategories = () =>
  useBrainStore.getState().categories.filter((category) => category.enabled);
export const selectSeenCardIds = () => useBrainStore.getState().seenCardIds;
export const resetBrainStore = () => useBrainStore.getState().resetAll();
export const markCardSeen = (id: string) => useBrainStore.getState().addSeenCard(id);
export const recordFact = (category: CategoryId, action: FactAction) =>
  useBrainStore.getState().recordFactInteraction(category, action);
export const recordQuiz = (category: CategoryId, correct: boolean) =>
  useBrainStore.getState().recordQuizResult(category, correct);
export const getHasHydrated = () => useBrainStore.getState().hasHydrated;
export const getEnabledCategoryIds = (): CategoryId[] =>
  selectEnabledCategories().map((category) => category.id);
