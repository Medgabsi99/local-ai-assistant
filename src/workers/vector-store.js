// ============================================================
// Browser-Native Vector Store using IndexedDB (Dexie)
// No full-array rewrites — each vector is stored individually
// ============================================================

import Dexie from 'dexie';

const VECTOR_DB_NAME = 'LocalAIVectors';

class VectorStoreDB extends Dexie {
  constructor() {
    super(VECTOR_DB_NAME);
    this.version(1).stores({
      vectors: '++id, documentId, chunkIndex, *tags',
    });
  }
}

let vectorDb = null;

function getDb() {
  if (!vectorDb) vectorDb = new VectorStoreDB();
  return vectorDb;
}

class VectorStore {
  constructor() {
    this.vectors = [];
    this.metadata = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    const db = getDb();
    const all = await db.vectors.toArray();
    this.vectors = all.map((r) => r.embedding);
    this.metadata = all.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      index: r.id,
    }));
    this.initialized = true;
  }

  async addVector(embedding, metadata = {}) {
    await this.init();
    const db = getDb();
    const id = await db.vectors.add({
      embedding,
      documentId: metadata.documentId || null,
      documentTitle: metadata.documentTitle || '',
      chunkIndex: metadata.chunkIndex ?? -1,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
    });
    this.vectors.push(embedding);
    this.metadata.push({ ...metadata, index: id });
    return id;
  }

  async addVectors(embeddings, metadatas = []) {
    await this.init();
    const db = getDb();
    const items = embeddings.map((embedding, i) => ({
      embedding,
      documentId: metadatas[i]?.documentId || null,
      documentTitle: metadatas[i]?.documentTitle || '',
      chunkIndex: metadatas[i]?.chunkIndex ?? -1,
      tags: metadatas[i]?.tags || [],
      createdAt: new Date().toISOString(),
    }));
    const ids = await db.vectors.bulkAdd(items, { allKeys: true });
    for (let i = 0; i < embeddings.length; i++) {
      this.vectors.push(embeddings[i]);
      this.metadata.push({ ...(metadatas[i] || {}), index: ids[i] });
    }
    return ids;
  }

  async deleteVectorsByDocumentId(documentId) {
    await this.init();
    const db = getDb();
    await db.vectors.where('documentId').equals(documentId).delete();
    const remaining = await db.vectors.toArray();
    this.vectors = remaining.map((r) => r.embedding);
    this.metadata = remaining.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      index: r.id,
    }));
  }

  async search(queryEmbedding, topK = 5, minSimilarity = 0.3) {
    await this.init();
    if (this.vectors.length === 0) return [];
    const similarities = this.vectors.map((vec, index) => ({
      similarity: cosineSimilarity(queryEmbedding, vec),
      index,
      metadata: this.metadata[index],
    }));
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.filter((s) => s.similarity >= minSimilarity).slice(0, topK);
  }

  async clear() {
    const db = getDb();
    await db.vectors.clear();
    this.vectors = [];
    this.metadata = [];
  }

  async exportData() {
    await this.init();
    return { vectors: this.vectors, metadata: this.metadata };
  }

  async importData(payload = {}) {
    await this.clear();
    if (!Array.isArray(payload.vectors) || !Array.isArray(payload.metadata)) return;
    const db = getDb();
    const items = payload.vectors.map((embedding, i) => ({
      embedding,
      documentId: payload.metadata[i]?.documentId || null,
      documentTitle: payload.metadata[i]?.documentTitle || '',
      chunkIndex: payload.metadata[i]?.chunkIndex ?? -1,
      tags: payload.metadata[i]?.tags || [],
      createdAt: new Date().toISOString(),
    }));
    const ids = await db.vectors.bulkAdd(items, { allKeys: true });
    this.vectors = payload.vectors;
    this.metadata = payload.metadata.map((m, i) => ({ ...m, index: ids[i] }));
  }

  async getStats() {
    await this.init();
    return {
      totalVectors: this.vectors.length,
      totalDocuments: new Set(this.metadata.map((m) => m.documentId)).size,
      dimension: this.vectors.length > 0 ? this.vectors[0].length : 0,
    };
  }
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na);
  nb = Math.sqrt(nb);
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
}

let storeInstance = null;

export async function getVectorStore() {
  if (!storeInstance) {
    storeInstance = new VectorStore();
    await storeInstance.init();
  }
  return storeInstance;
}

export { VectorStore };
