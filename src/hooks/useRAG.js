import { useState, useCallback, useRef } from 'react';
import { ai, pdf } from '../workers/worker-bridge';
import { getVectorStore } from '../workers/vector-store';
import {
  saveDocument,
  saveDocumentChunks,
  getDocumentChunks,
} from '../db/database';

export function useRAG() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ status: '', message: '', progress: 0 });
  const vectorStoreRef = useRef(null);

  const getStore = async () => {
    if (!vectorStoreRef.current) {
      vectorStoreRef.current = await getVectorStore();
    }
    return vectorStoreRef.current;
  };

  // Process a PDF file: extract → chunk → embed → store
  const processPDF = useCallback(async (file) => {
    setIsProcessing(true);
    setProgress({ status: 'reading', message: 'Reading file...', progress: 0 });

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Step 1: Extract text from PDF
      setProgress({ status: 'extracting', message: 'Extracting text...', progress: 10 });
      const extractionResult = await pdf.extract(arrayBuffer, file.name, {
        onProgress: (data) => setProgress(data),
      });

      const fullText = extractionResult.text;

      // Step 2: Save document to IndexedDB
      setProgress({ status: 'saving', message: 'Saving document...', progress: 85 });
      const docId = await saveDocument({
        title: file.name,
        content: fullText,
        fileType: 'application/pdf',
      });

      // Step 3: Chunk the text
      setProgress({ status: 'chunking', message: 'Chunking text...', progress: 90 });
      const chunkResult = await pdf.chunkText(fullText, {
        chunkSize: 500,
        chunkOverlap: 100,
      });

      // Step 4: Save chunks to IndexedDB
      await saveDocumentChunks(docId, chunkResult.chunks);

      // Step 5: Generate embeddings for each chunk
      setProgress({
        status: 'embedding',
        message: `Embedding ${chunkResult.chunks.length} chunks...`,
        progress: 92,
      });

      const embeddingResult = await ai.getEmbeddingsBatch(chunkResult.chunks, {
        onProgress: (data) => setProgress(data),
      });

      // Step 6: Store vectors in local vector store
      setProgress({ status: 'indexing', message: 'Indexing vectors...', progress: 98 });
      const store = await getStore();
      const metadatas = chunkResult.chunks.map((_, i) => ({
        documentId: docId,
        documentTitle: file.name,
        chunkIndex: i,
      }));
      await store.addVectors(embeddingResult.embeddings, metadatas);

      setProgress({ status: 'complete', message: 'Document processed!', progress: 100 });

      return {
        docId,
        totalChunks: chunkResult.chunks.length,
        totalPages: extractionResult.totalPages,
      };
    } catch (error) {
      setProgress({ status: 'error', message: error.message, progress: 0 });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Process text content (for .txt, .md files)
  const processText = useCallback(async (content, title, fileType) => {
    setIsProcessing(true);
    setProgress({ status: 'saving', message: 'Processing text...', progress: 20 });

    try {
      // Save document
      const docId = await saveDocument({ title, content, fileType });

      // Chunk the text
      setProgress({ status: 'chunking', message: 'Chunking text...', progress: 40 });
      const chunkResult = await pdf.chunkText(content, {
        chunkSize: 500,
        chunkOverlap: 100,
      });

      // Save chunks
      await saveDocumentChunks(docId, chunkResult.chunks);

      // Generate embeddings
      setProgress({
        status: 'embedding',
        message: `Embedding ${chunkResult.chunks.length} chunks...`,
        progress: 60,
      });

      const embeddingResult = await ai.getEmbeddingsBatch(chunkResult.chunks, {
        onProgress: (data) => setProgress(data),
      });

      // Store vectors
      setProgress({ status: 'indexing', message: 'Indexing vectors...', progress: 90 });
      const store = await getStore();
      const metadatas = chunkResult.chunks.map((_, i) => ({
        documentId: docId,
        documentTitle: title,
        chunkIndex: i,
      }));
      await store.addVectors(embeddingResult.embeddings, metadatas);

      setProgress({ status: 'complete', message: 'Document processed!', progress: 100 });

      return { docId, totalChunks: chunkResult.chunks.length };
    } catch (error) {
      setProgress({ status: 'error', message: error.message, progress: 0 });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Search for relevant context
  const searchSimilar = useCallback(async (query, topK = 3) => {
    const store = await getStore();

    // Generate query embedding
    const result = await ai.getEmbedding(query);
    const queryEmbedding = result.embedding;

    // Search vector store
    const matches = await store.search(queryEmbedding, topK, 0.3);

    // Fetch full chunk content from IndexedDB
    const contexts = [];
    for (const match of matches) {
      if (match.metadata.documentId && match.metadata.chunkIndex !== undefined) {
        const chunks = await getDocumentChunks(match.metadata.documentId);
        const chunk = chunks.find((c) => c.chunkIndex === match.metadata.chunkIndex);
        if (chunk) {
          contexts.push({
            content: chunk.content,
            documentTitle: match.metadata.documentTitle,
            similarity: match.similarity,
          });
        }
      }
    }

    return contexts;
  }, []);

  // Get vector store stats
  const getStats = useCallback(async () => {
    const store = await getStore();
    return store.getStats();
  }, []);

  // Clear all vectors
  const clearVectors = useCallback(async () => {
    const store = await getStore();
    await store.clear();
  }, []);

  return {
    processPDF,
    processText,
    searchSimilar,
    getStats,
    clearVectors,
    isProcessing,
    progress,
  };
}
