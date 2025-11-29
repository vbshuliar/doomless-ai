// Category types shared across the app. This abstraction lets us mix built-in packs with
// user-imported files that will later flow into the LLM/RAG system.
export type CategoryId = string;

export enum CategoryKind {
  Default = 'default',
  Imported = 'imported',
}

export type CategorySourceType = 'pdf' | 'txt' | 'docx' | 'other';

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  kind: CategoryKind;
  enabled: boolean;
  sourceFileUri?: string;
  sourceFileType?: CategorySourceType;
  createdAt?: number;
}

export const DEFAULT_CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'science',
    name: 'Science',
    kind: CategoryKind.Default,
    enabled: true,
  },
  {
    id: 'history',
    name: 'History',
    kind: CategoryKind.Default,
    enabled: true,
  },
  {
    id: 'psychology',
    name: 'Psychology',
    kind: CategoryKind.Default,
    enabled: true,
  },
  {
    id: 'literature',
    name: 'Literature',
    kind: CategoryKind.Default,
    enabled: true,
  },
  {
    id: 'random',
    name: 'Curiosities',
    kind: CategoryKind.Default,
    enabled: true,
  },
];

export const MAX_ENABLED_CATEGORIES = 5;

export const getDefaultCategoryIds = (): CategoryId[] =>
  DEFAULT_CATEGORY_DEFINITIONS.map((category) => category.id);

export const findDefaultCategoryById = (id: CategoryId) =>
  DEFAULT_CATEGORY_DEFINITIONS.find((entry) => entry.id === id);
