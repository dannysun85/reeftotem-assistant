/**
 * Knowledge Base type definitions
 * Types for knowledge base management, documents, chunks, and RAG
 */

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embeddingModel: string;
  embeddingDimension: number;
  documentCount: number;
  totalChunks: number;
  totalSize: number;
  chunkSize: number;
  chunkOverlap: number;
  watchedFolder?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  filePath: string;
  fileType: 'pdf' | 'txt' | 'md' | 'docx' | 'csv' | 'url';
  fileSize: number;
  chunkCount: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  content: string;
  metadata: { page?: number; lineStart?: number; lineEnd?: number; source?: string };
}

export interface RAGResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

export interface RAGConfig {
  topK: number;
  scoreThreshold: number;
  maxContextTokens: number;
}
