/**
 * Knowledge Store
 * Manages knowledge bases, documents, search, and progress events.
 */

import { create } from 'zustand';
import { invoke, on } from '@/lib/bridge';
import type { KnowledgeBase, KnowledgeDocument, RAGResult, RAGConfig } from '@/types/knowledge';

export interface EmbeddingOption {
  label: string;
  value: string;
  dimension: number;
  available: boolean;
}

interface DocumentProgressEvent {
  documentId: string;
  stage: string;
  percent: number;
}

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  currentKBId: string | null;
  documents: KnowledgeDocument[];
  loading: boolean;
  error: string | null;
  searchResults: RAGResult[];
  searchQuery: string;
  searching: boolean;
  embeddingOptions: EmbeddingOption[];
}

interface KnowledgeActions {
  fetchKnowledgeBases: () => Promise<void>;
  createKnowledgeBase: (config: Record<string, unknown>) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (id: string, updates: Record<string, unknown>) => Promise<void>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
  setCurrentKB: (id: string | null) => void;
  fetchDocuments: (kbId: string) => Promise<void>;
  addDocument: (kbId: string, filePath: string, fileName: string, fileType: string, fileSize: number) => Promise<KnowledgeDocument>;
  addUrl: (kbId: string, url: string) => Promise<KnowledgeDocument>;
  removeDocument: (documentId: string) => Promise<void>;
  reprocessDocument: (documentId: string) => Promise<void>;
  searchKB: (kbId: string, query: string) => Promise<void>;
  clearSearch: () => void;
  fetchEmbeddingOptions: () => Promise<void>;
  initProgressListener: () => () => void;
}

// 模块级变量：防止重复注册监听器
let _progressUnlisten: (() => void) | null = null;

export const useKnowledgeStore = create<KnowledgeState & KnowledgeActions>()((set, get) => ({
  knowledgeBases: [],
  currentKBId: null,
  documents: [],
  loading: false,
  error: null,
  searchResults: [],
  searchQuery: '',
  searching: false,
  embeddingOptions: [],

  fetchKnowledgeBases: async () => {
    set({ loading: true, error: null });
    try {
      const kbs = await invoke<KnowledgeBase[]>('knowledge_list');
      set({ knowledgeBases: kbs, loading: false });
    } catch (err) {
      console.warn('Failed to fetch knowledge bases:', err);
      set({ loading: false, error: String(err) });
    }
  },

  createKnowledgeBase: async (config) => {
    try {
      const kb = await invoke<KnowledgeBase>('knowledge_create', { config });
      await get().fetchKnowledgeBases();
      return kb;
    } catch (err) {
      console.error('Failed to create knowledge base:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  updateKnowledgeBase: async (id, updates) => {
    try {
      await invoke('knowledge_update', { id, updates });
      await get().fetchKnowledgeBases();
    } catch (err) {
      console.error('Failed to update knowledge base:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  deleteKnowledgeBase: async (id) => {
    try {
      await invoke('knowledge_delete', { id });
      if (get().currentKBId === id) {
        set({ currentKBId: null, documents: [] });
      }
      await get().fetchKnowledgeBases();
    } catch (err) {
      console.error('Failed to delete knowledge base:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  setCurrentKB: (id) => {
    set({ currentKBId: id, documents: [], searchResults: [], searchQuery: '' });
    if (id) {
      get().fetchDocuments(id);
    }
  },

  fetchDocuments: async (kbId) => {
    try {
      const docs = await invoke<KnowledgeDocument[]>('knowledge_list_documents', { kbId });
      set({ documents: docs });
    } catch (err) {
      console.warn('Failed to fetch documents:', err);
    }
  },

  addDocument: async (kbId, filePath, fileName, fileType, fileSize) => {
    try {
      const doc = await invoke<KnowledgeDocument>('knowledge_add_document', {
        kbId, filePath, fileName, fileType, fileSize,
      });
      await get().fetchDocuments(kbId);
      return doc;
    } catch (err) {
      console.error('Failed to add document:', err);
      throw err;
    }
  },

  addUrl: async (kbId, url) => {
    try {
      const doc = await invoke<KnowledgeDocument>('knowledge_add_url', { kbId, url });
      await get().fetchDocuments(kbId);
      return doc;
    } catch (err) {
      console.error('Failed to add URL:', err);
      throw err;
    }
  },

  removeDocument: async (documentId) => {
    try {
      await invoke('knowledge_remove_document', { documentId });
      const kbId = get().currentKBId;
      if (kbId) {
        await get().fetchDocuments(kbId);
        await get().fetchKnowledgeBases();
      }
    } catch (err) {
      console.error('Failed to remove document:', err);
      throw err;
    }
  },

  reprocessDocument: async (documentId) => {
    try {
      await invoke('knowledge_reprocess_document', { documentId });
      const kbId = get().currentKBId;
      if (kbId) {
        await get().fetchDocuments(kbId);
      }
    } catch (err) {
      console.error('Failed to reprocess document:', err);
      throw err;
    }
  },

  searchKB: async (kbId, query) => {
    set({ searching: true, searchQuery: query });
    try {
      const results = await invoke<RAGResult[]>('knowledge_search', { kbId, query });
      set({ searchResults: results, searching: false });
    } catch (err) {
      console.error('Failed to search:', err);
      set({ searching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], searchQuery: '' });
  },

  fetchEmbeddingOptions: async () => {
    try {
      const options = await invoke<EmbeddingOption[]>('knowledge_get_embedding_options');
      set({ embeddingOptions: options });
    } catch (err) {
      console.warn('Failed to fetch embedding options:', err);
    }
  },

  initProgressListener: () => {
    // 清理上一个监听器，防止累积
    if (_progressUnlisten) {
      _progressUnlisten();
      _progressUnlisten = null;
    }

    const unlisten = on('knowledge_documentProgress', (data: unknown) => {
      const event = data as DocumentProgressEvent;
      // Update document status locally based on progress
      set((state) => ({
        documents: state.documents.map((doc) => {
          if (doc.id === event.documentId) {
            if (event.stage === 'done') {
              return { ...doc, status: 'ready' as const };
            }
            return { ...doc, status: 'processing' as const };
          }
          return doc;
        }),
      }));

      // Refetch when done to get accurate data
      if (event.stage === 'done') {
        const kbId = get().currentKBId;
        if (kbId) {
          get().fetchDocuments(kbId);
          get().fetchKnowledgeBases();
        }
      }
    });

    _progressUnlisten = unlisten;
    return unlisten;
  },
}));
