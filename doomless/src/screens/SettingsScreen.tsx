// Settings screen provides a reset button and communicates upcoming AI features.
// This now includes category management for both default and user-imported sources.
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';

import {
  useBrainStore,
  type BrainState,
  type ImportCategoryResult,
  type ToggleCategoryResult,
} from '../store/brainStore';
import { CategoryKind, MAX_ENABLED_CATEGORIES } from '../types/categories';
import { detectSourceType, sortCategoriesForDisplay } from '../utils/categoryUtils';
import { documentIngestionService } from '../services/DocumentIngestionService';

export const SettingsScreen: React.FC = () => {
  const resetAll = useBrainStore((state: BrainState) => state.resetAll);
  const categories = useBrainStore((state: BrainState) => state.categories);
  const importCategory = useBrainStore((state: BrainState) => state.importCategory);
  const toggleCategoryEnabled = useBrainStore(
    (state: BrainState) => state.toggleCategoryEnabled,
  );
  const renameCategory = useBrainStore((state: BrainState) => state.renameCategory);
  const deleteCategory = useBrainStore((state: BrainState) => state.deleteCategory);

  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const enabledCount = useMemo(
    () => categories.filter((category) => category.enabled).length,
    [categories],
  );

  const sortedCategories = useMemo(
    () => sortCategoriesForDisplay(categories),
    [categories],
  );

  const openRenameModal = (id: string, currentName: string) => {
    setRenameTargetId(id);
    setRenameValue(currentName);
  };

  const closeRenameModal = () => {
    setRenameTargetId(null);
    setRenameValue('');
  };

  const confirmRename = () => {
    if (!renameTargetId) {
      return;
    }
    renameCategory(renameTargetId, renameValue.trim());
    closeRenameModal();
  };

  const handleToggleCategory = (id: string, value: boolean) => {
    const result: ToggleCategoryResult = toggleCategoryEnabled(id, value);
    if (!result.success && result.reason) {
      Alert.alert('Category limit', result.reason);
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert(
      'Delete category?',
      `Remove “${name}” from your sources? You can import it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCategory(id),
        },
      ],
    );
  };

  const handleImportSource = async () => {
    let createdCategoryId: string | null = null;
    try {
      if (isImporting) {
        return;
      }
      setIsImporting(true);
      // Once the LLM/RAG pipeline lands, this picker response will seed ingestion for embeddings.
      const files = await pick({
        presentationStyle: 'fullScreen',
        type: [types.pdf, types.plainText, types.doc, types.docx, types.allFiles],
      });

      const [file] = files;
      if (!file) {
        Alert.alert('Import failed', 'Could not read the selected file path.');
        return;
      }

      const uri = file.uri;
      if (!uri) {
        Alert.alert('Import failed', 'Could not read the selected file path.');
        return;
      }

      const name = file.name ?? 'Imported Source';
      const result: ImportCategoryResult = importCategory({
        name,
        sourceFileUri: uri,
        sourceFileType: detectSourceType(file.name, file.type),
        createdAt: Date.now(),
      });

      if (!result.success) {
        Alert.alert('Import failed', 'We could not register that source. Please try again.');
        return;
      }

      if (!result.enabled && result.reason) {
        Alert.alert('Category added', `${name} was added but left disabled.\n${result.reason}`);
      }

      if (!result.categoryId) {
        throw new Error('Unable to register the new category for ingestion.');
      }

      createdCategoryId = result.categoryId;

      const { factCount } = await documentIngestionService.ingest({
        categoryId: result.categoryId,
        categoryName: name,
        fileUri: uri,
        fileName: name,
        mimeType: file.type,
      });

      if (factCount === 0) {
        deleteCategory(result.categoryId);
        createdCategoryId = null;
        Alert.alert(
          'No facts extracted',
          'We could not extract any facts from that file. The category has been removed.',
        );
        return;
      }

      Alert.alert('Import complete', `Added ${factCount} new facts from “${name}”.`);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.warn('Failed to import file', error);
      Alert.alert('Import failed', 'Something went wrong while importing the file.');
      if (createdCategoryId) {
        deleteCategory(createdCategoryId);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset DoomLess',
      'This will clear your local progress and preferences. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAll();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sources &amp; Categories</Text>
          <TouchableOpacity
            style={[styles.importCard, isImporting && styles.importCardDisabled]}
            onPress={handleImportSource}
            disabled={isImporting}
          >
            <View style={styles.importIconBadge}>
              <Text style={styles.importIconText}>＋</Text>
            </View>
            <View style={styles.importCopy}>
              <Text style={styles.importTitle}>Import source file</Text>
              <Text style={styles.importSubtitle}>
                {isImporting ? 'Processing with your offline model…' : 'PDF, TXT, or Word document'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.categoryListShell}>
            <ScrollView
              contentContainerStyle={styles.categoryListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {sortedCategories.map((category) => {
                const isImported = category.kind === CategoryKind.Imported;
                const metaLabel = isImported
                  ? `${category.sourceFileType?.toUpperCase() ?? 'FILE'} source`
                  : 'Default pack';

                return (
                  <View
                    key={category.id}
                    style={[styles.categoryRow, !category.enabled && styles.categoryRowDisabled]}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryEmoji}>
                        {isImported ? '📄' : '✨'}
                      </Text>
                      <View style={styles.categoryTextGroup}>
                        <Text
                          style={[styles.categoryName, !category.enabled && styles.categoryNameDisabled]}
                        >
                          {category.name}
                        </Text>
                        <Text style={styles.categoryMeta}>{metaLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.categoryActions}>
                      {isImported ? (
                        <View style={styles.categoryActionButtons}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => openRenameModal(category.id, category.name)}
                            style={styles.iconButton}
                          >
                            <Text style={styles.iconButtonText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => handleDeleteCategory(category.id, category.name)}
                            style={styles.iconButton}
                          >
                            <Text style={styles.iconButtonText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.categoryActionButtons}>
                          <Text style={[styles.iconButtonText, styles.iconButtonDisabled]}>🔒</Text>
                        </View>
                      )}
                      <Switch
                        value={category.enabled}
                        onValueChange={(value) => handleToggleCategory(category.id, value)}
                        trackColor={{ false: '#cbd5f5', true: '#2563eb' }}
                        thumbColor={category.enabled ? '#f1f5f9' : '#f8fafc'}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          <Text style={styles.categoryHint}>
            {enabledCount} of {MAX_ENABLED_CATEGORIES} categories active
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Controls</Text>
          <Text style={styles.sectionBody}>
            Everything lives on this device. Reset whenever you want a fresh curiosity journey.
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonLabel}>Reset Local Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.sectionBody}>
            On-device AI via the Cactus SDK will personalize facts, remix quizzes, and let you chat with characters from your own PDFs—without leaving airplane mode.
          </Text>
          <Text style={styles.sectionBody}>
            We will also add optional PDF ingestion and retrieval-augmented generation backed by local embeddings (think Qwen3-Embedding-0.6B) so your brain feed adapts to your library.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={Boolean(renameTargetId)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename category</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Category name"
              placeholderTextColor="#94a3b8"
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={closeRenameModal}>
                <Text style={styles.modalButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={confirmRename}>
                <Text style={[styles.modalButtonLabel, styles.modalButtonPrimaryLabel]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 18,
  },
  section: {
    backgroundColor: '#fdfdfd',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#cbd5f5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  importCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  importCardDisabled: {
    opacity: 0.6,
  },
  importIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconText: {
    fontSize: 20,
    color: '#f8fafc',
    marginTop: -2,
  },
  importCopy: {
    flex: 1,
    gap: 1,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  importSubtitle: {
    fontSize: 13,
    color: '#475569',
  },
  categoryListShell: {
    maxHeight: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  categoryListContent: {
    paddingVertical: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  categoryRowDisabled: {
    opacity: 0.7,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryTextGroup: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  categoryNameDisabled: {
    color: '#475569',
  },
  categoryMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  iconButtonText: {
    fontSize: 15,
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  categoryHint: {
    fontSize: 13,
    color: '#475569',
    marginTop: -4,
  },
  resetButton: {
    marginTop: 10,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 3,
  },
  resetButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fdfdfd',
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  modalButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  modalButtonPrimary: {
    backgroundColor: '#2563eb',
  },
  modalButtonPrimaryLabel: {
    color: '#f8fafc',
  },
});
