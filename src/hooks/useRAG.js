import { useCallback, useRef, useState } from 'react';
import { ai, pdf } from '../workers/worker-bridge';
import { getVectorStore } from '../workers/vector-store';
import { getDocumentChunks, saveDocument, saveDocumentChunks } from '../db/database';
import { CHUNK_OVERLAP, CHUNK_SIZE, RAG_FETCH_MULTIPLIER } from '../lib/constants';
import { hybridSearch } from '../lib/hybrid-search';

export function useRAG() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ status: '', message: '', progress: 0 });
  const [capturedImage, setCapturedImage] = useState(null); // { dataUrl, file }
  const vectorStoreRef = useRef(null);

  const getStore = async () => {
    if (!vectorStoreRef.current) {
      vectorStoreRef.current = await getVectorStore();
    }
    return vectorStoreRef.current;
  };

  const processPDF = useCallback(async (file) => {
    setIsProcessing(true);
    setProgress({ status: 'reading', message: 'Reading file...', progress: 0 });
    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress({ status: 'extracting', message: 'Extracting text...', progress: 10 });
      const extractionResult = await pdf.extract(arrayBuffer, file.name, { onProgress: (data) => setProgress(data) });
      const fullText = extractionResult.text;
      setProgress({ status: 'saving', message: 'Saving document...', progress: 85 });
      const docId = await saveDocument({ title: file.name, content: fullText, fileType: 'application/pdf' });
      setProgress({ status: 'chunking', message: 'Chunking text...', progress: 90 });
      const chunkResult = await pdf.chunkText(fullText, { chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
      await saveDocumentChunks(docId, chunkResult.chunks);
      setProgress({ status: 'embedding', message: `Embedding ${chunkResult.chunks.length} chunks...`, progress: 92 });
      const embeddingResult = await ai.getEmbeddingsBatch(chunkResult.chunks, {
        onProgress: (data) => setProgress(data),
      });
      setProgress({ status: 'indexing', message: 'Indexing vectors...', progress: 98 });
      const store = await getStore();
      const metadatas = chunkResult.chunks.map((_, i) => ({
        documentId: docId,
        documentTitle: file.name,
        chunkIndex: i,
      }));
      await store.addVectors(embeddingResult.embeddings, metadatas);
      setProgress({ status: 'complete', message: 'Document processed!', progress: 100 });
      return { docId, totalChunks: chunkResult.chunks.length, totalPages: extractionResult.totalPages };
    } catch (error) {
      setProgress({ status: 'error', message: error.message, progress: 0 });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processText = useCallback(async (content, title, fileType) => {
    setIsProcessing(true);
    setProgress({ status: 'saving', message: 'Processing text...', progress: 20 });
    try {
      const docId = await saveDocument({ title, content, fileType });
      setProgress({ status: 'chunking', message: 'Chunking text...', progress: 40 });
      const chunkResult = await pdf.chunkText(content, { chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
      await saveDocumentChunks(docId, chunkResult.chunks);
      setProgress({ status: 'embedding', message: `Embedding ${chunkResult.chunks.length} chunks...`, progress: 60 });
      const embeddingResult = await ai.getEmbeddingsBatch(chunkResult.chunks, {
        onProgress: (data) => setProgress(data),
      });
      setProgress({ status: 'indexing', message: 'Indexing vectors...', progress: 90 });
      const store = await getStore();
      const metadatas = chunkResult.chunks.map((_, i) => ({ documentId: docId, documentTitle: title, chunkIndex: i }));
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

  const searchSimilar = useCallback(async (query, topK = 3) => {
    const store = await getStore();
    const result = await ai.getEmbedding(query);
    const queryEmbedding = result.embedding;
    const matches = await store.search(queryEmbedding, topK * RAG_FETCH_MULTIPLIER, 0.2);

    const allChunks = [];
    const seenDocChunks = new Set();
    const docChunkCache = new Map();

    for (const match of matches) {
      if (match.metadata.documentId && match.metadata.chunkIndex !== undefined) {
        const key = `${match.metadata.documentId}-${match.metadata.chunkIndex}`;
        if (!seenDocChunks.has(key)) {
          seenDocChunks.add(key);
          let chunks = docChunkCache.get(match.metadata.documentId);
          if (!chunks) {
            chunks = await getDocumentChunks(match.metadata.documentId);
            docChunkCache.set(match.metadata.documentId, chunks);
          }
          const chunk = chunks.find((c) => c.chunkIndex === match.metadata.chunkIndex);
          if (chunk)
            allChunks.push({
              content: chunk.content,
              metadata: {
                documentId: match.metadata.documentId,
                documentTitle: match.metadata.documentTitle,
                chunkIndex: match.metadata.chunkIndex,
              },
              similarity: match.similarity,
            });
        }
      }
    }

    const reRanked = await hybridSearch(query, allChunks, allChunks, 0.6);
    return reRanked
      .slice(0, topK)
      .map((match) => ({
        content: match.content,
        documentTitle: match.metadata?.documentTitle || '',
        similarity: match.similarity || 0,
        bm25Score: match.bm25Score || 0,
        vectorScore: match.vectorScore || 0,
      }));
  }, []);

  const captureImage = useCallback(async (file) => {
    // Read file as base64 data URL — transformers.js can fetch data URLs in workers
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    setCapturedImage({ dataUrl, file, name: file.name });

    // Pass the data URL string — the worker pipeline can fetch it natively
    try {
      setProgress({ status: 'analyzing', message: 'Analyzing image...', progress: 20 });
      const result = await ai.captionImage(dataUrl);
      if (result?.caption) {
        setProgress({ status: 'complete', message: `Image: ${result.caption}`, progress: 100 });
        return { caption: result.caption, dataUrl };
      }
    } catch (e) {
      console.warn('Image caption failed:', e.message);
    }
    return { dataUrl };
  }, []);

  const clearCapturedImage = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const getStats = useCallback(async () => {
    const store = await getStore();
    return store.getStats();
  }, []);
  const clearVectors = useCallback(async () => {
    const store = await getStore();
    await store.clear();
  }, []);

  return {
    processPDF,
    processText,
    searchSimilar,
    captureImage,
    clearCapturedImage,
    capturedImage,
    getStats,
    clearVectors,
    isProcessing,
    progress,
  };
}
