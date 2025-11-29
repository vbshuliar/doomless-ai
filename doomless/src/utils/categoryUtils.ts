// Helpers for category metadata. This is where we can later plug in richer import logic
// (fingerprinting, embeddings, etc.) once the LLM/RAG layer is ready.
import {
  CategoryKind,
  DEFAULT_CATEGORY_DEFINITIONS,
  type CategoryDefinition,
  type CategorySourceType,
} from '../types/categories';

const extensionToType: Record<string, CategorySourceType> = {
  pdf: 'pdf',
  txt: 'txt',
  doc: 'docx',
  docx: 'docx',
};

export const detectSourceType = (
  fileName?: string | null,
  mimeType?: string | null,
): CategorySourceType => {
  if (fileName) {
    const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
    if (match) {
      const ext = match[1];
      if (extensionToType[ext]) {
        return extensionToType[ext];
      }
    }
  }
  if (mimeType) {
    if (mimeType.includes('pdf')) {
      return 'pdf';
    }
    if (mimeType.includes('plain')) {
      return 'txt';
    }
    if (mimeType.includes('word')) {
      return 'docx';
    }
  }
  return 'other';
};

export const sortCategoriesForDisplay = (categories: CategoryDefinition[]) => {
  const cloned = [...categories];
  const defaultOrder = new Map(
    DEFAULT_CATEGORY_DEFINITIONS.map((definition, index) => [definition.id, index]),
  );
  cloned.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === CategoryKind.Default ? -1 : 1;
    }
    if (a.kind === CategoryKind.Default && b.kind === CategoryKind.Default) {
      return (defaultOrder.get(a.id) ?? 0) - (defaultOrder.get(b.id) ?? 0);
    }
    const aCreated = a.createdAt ?? 0;
    const bCreated = b.createdAt ?? 0;
    if (a.kind === CategoryKind.Imported && b.kind === CategoryKind.Imported && aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    return a.name.localeCompare(b.name);
  });
  return cloned;
};
