// ============================================================
// Browser-Native Vector Store using IndexedDB (Dexie)
// Uses HNSW index for approximate nearest neighbor search
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

// ============================================================
// HNSW (Hierarchical Navigable Small World) Index
// Approximate nearest neighbor search — O(log n) per query
// ============================================================

class HNSWIndex {
  constructor(metric = cosineSimilarity) {
    this.metric = metric;
    this.L = 0;
    this.M = 16;
    this.Mmax = 32;
    this.efConstruction = 200;
    this.efSearch = 50;
    this.ml = 1 / Math.log(this.M);
    this.enterpoint = null;
    this.graph = [];
    this.data = [];
  }

  _randomLevel() {
    let l = 0;
    while (Math.random() < this.ml && l < this.L) l++;
    return l;
  }

  _distance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
    return d;
  }

  _searchLayer(query, ep, lc) {
    let best = { node: ep, dist: this._distance(query, this.data[ep]) };
    const visited = new Set([ep]);
    let changed = true;
    while (changed) {
      changed = false;
      const neighbors = this.graph[lc]?.get(best.node);
      if (!neighbors) break;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        const d = this._distance(query, this.data[n]);
        if (d < best.dist) { best = { node: n, dist: d }; changed = true; }
      }
    }
    return best.node;
  }

  insert(vec, idx) {
    this.data[idx] = vec;
    if (this.enterpoint === null) {
      this.graph[0] = new Map();
      this.graph[0].set(idx, new Set());
      this.enterpoint = idx;
      this.L = 0;
      return;
    }
    const l = this._randomLevel();
    if (l > this.L) {
      for (let i = this.L + 1; i <= l; i++) { this.graph[i] = new Map(); this.graph[i].set(this.enterpoint, new Set()); }
      this.L = l;
    }
    let ep = this.enterpoint;
    for (let lc = this.L; lc > l; lc--) ep = this._searchLayer(vec, ep, lc);
    for (let lc = Math.min(l, this.L); lc >= 0; lc--) {
      if (!this.graph[lc]) this.graph[lc] = new Map();
      if (!this.graph[lc].has(idx)) this.graph[lc].set(idx, new Set());
      const candidates = this._selectNeighbors(vec, ep, lc, this.efConstruction);
      const neighbors = candidates.slice(0, lc === 0 ? this.M : this.Mmax);
      for (const n of neighbors) {
        this.graph[lc].get(idx).add(n);
        this.graph[lc].get(n)?.add(idx);
        if (this.graph[lc].get(n)?.size > (lc === 0 ? this.M : this.Mmax)) {
          const conns = Array.from(this.graph[lc].get(n));
          const withDist = conns.map((c) => ({ node: c, dist: this._distance(this.data[c], this.data[n]) }));
          withDist.sort((a, b) => a.dist - b.dist);
          this.graph[lc].set(n, new Set(withDist.slice(0, lc === 0 ? this.M : this.Mmax).map((x) => x.node)));
        }
      }
      if (lc > 0) ep = candidates.length > 0 ? candidates[0] : ep;
    }
  }

  _selectNeighbors(query, ep, lc, ef) {
    const candidates = [];
    const visited = new Set();
    const queue = [ep];
    visited.add(ep);
    while (queue.length > 0 && candidates.length < ef) {
      const curr = queue.shift();
      candidates.push({ node: curr, dist: this._distance(query, this.data[curr]) });
      const neighbors = this.graph[lc]?.get(curr);
      if (!neighbors) continue;
      for (const n of neighbors) { if (!visited.has(n)) { visited.add(n); queue.push(n); } }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.map((c) => c.node);
  }

  search(query, topK) {
    if (this.enterpoint === null || this.data.length === 0) return [];
    let ep = this.enterpoint;
    for (let lc = this.L; lc >= 0; lc--) ep = this._searchLayer(query, ep, lc);
    const candidates = [];
    const visited = new Set([ep]);
    const queue = [{ node: ep, dist: this._distance(query, this.data[ep]) }];
    const ef = Math.min(this.efSearch, this.data.length);
    while (queue.length > 0) {
      queue.sort((a, b) => a.dist - b.dist);
      const curr = queue.shift();
      if (candidates.length >= ef && curr.dist > candidates[candidates.length - 1]?.dist) break;
      candidates.push(curr);
      candidates.sort((a, b) => a.dist - b.dist);
      if (candidates.length > ef) candidates.length = ef;
      const neighbors = this.graph[0]?.get(curr.node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        const d = this._distance(query, this.data[n]);
        if (candidates.length < ef || d < candidates[candidates.length - 1].dist) queue.push({ node: n, dist: d });
      }
    }
    return candidates.slice(0, topK).map((c) => ({ node: c.node, similarity: this.metric(query, this.data[c.node]) }));
  }

  remove(idx) {
    if (!this.data[idx]) return;
    this.data[idx] = null;
    for (let lc = 0; lc <= this.L; lc++) {
      const layer = this.graph[lc];
      if (!layer) continue;
      layer.delete(idx);
      for (const [, neighbors] of layer) neighbors.delete(idx);
    }
    if (this.enterpoint === idx) {
      for (let lc = this.L; lc >= 0; lc--) {
        if (this.graph[lc]?.size > 0) { this.enterpoint = this.graph[lc].keys().next().value; break; }
      }
    }
  }

  clear() { this.graph = []; this.data = []; this.enterpoint = null; this.L = 0; }
}

// ============================================================
// VectorStore — wraps HNSW index with IndexedDB persistence
// ============================================================

class VectorStore {
  constructor() {
    this.vectors = [];
    this.metadata = [];
    this.hnsw = new HNSWIndex();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    const db = getDb();
    const all = await db.vectors.toArray();
    this.vectors = all.map((r) => r.embedding);
    this.metadata = all.map((r) => ({ documentId: r.documentId, documentTitle: r.documentTitle, chunkIndex: r.chunkIndex, index: r.id }));
    // Build HNSW index from existing vectors
    for (let i = 0; i < this.vectors.length; i++) {
      this.hnsw.insert(this.vectors[i], i);
    }
    this.initialized = true;
  }

  async addVector(embedding, metadata = {}) {
    await this.init();
    const db = getDb();
    const id = await db.vectors.add({
      embedding, documentId: metadata.documentId || null, documentTitle: metadata.documentTitle || '',
      chunkIndex: metadata.chunkIndex ?? -1, tags: metadata.tags || [], createdAt: new Date().toISOString(),
    });
    const idx = this.vectors.length;
    this.vectors.push(embedding);
    this.metadata.push({ ...metadata, index: id });
    this.hnsw.insert(embedding, idx);
    return id;
  }

  async addVectors(embeddings, metadatas = []) {
    await this.init();
    const db = getDb();
    const items = embeddings.map((embedding, i) => ({
      embedding, documentId: metadatas[i]?.documentId || null, documentTitle: metadatas[i]?.documentTitle || '',
      chunkIndex: metadatas[i]?.chunkIndex ?? -1, tags: metadatas[i]?.tags || [], createdAt: new Date().toISOString(),
    }));
    const ids = await db.vectors.bulkAdd(items, { allKeys: true });
    for (let i = 0; i < embeddings.length; i++) {
      const idx = this.vectors.length;
      this.vectors.push(embeddings[i]);
      this.metadata.push({ ...(metadatas[i] || {}), index: ids[i] });
      this.hnsw.insert(embeddings[i], idx);
    }
    return ids;
  }

  async deleteVectorsByDocumentId(documentId) {
    await this.init();
    const db = getDb();
    await db.vectors.where('documentId').equals(documentId).delete();
    const remaining = await db.vectors.toArray();
    this.vectors = remaining.map((r) => r.embedding);
    this.metadata = remaining.map((r) => ({ documentId: r.documentId, documentTitle: r.documentTitle, chunkIndex: r.chunkIndex, index: r.id }));
    // Rebuild HNSW index
    this.hnsw.clear();
    for (let i = 0; i < this.vectors.length; i++) this.hnsw.insert(this.vectors[i], i);
  }

  async search(queryEmbedding, topK = 5, minSimilarity = 0.3) {
    await this.init();
    if (this.vectors.length === 0) return [];
    const results = this.hnsw.search(queryEmbedding, topK * 2);
    return results
      .filter((r) => r.similarity >= minSimilarity)
      .slice(0, topK)
      .map((r) => ({ similarity: r.similarity, index: r.node, metadata: this.metadata[r.node] }));
  }

  async clear() {
    const db = getDb();
    await db.vectors.clear();
    this.vectors = [];
    this.metadata = [];
    this.hnsw.clear();
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
      embedding, documentId: payload.metadata[i]?.documentId || null, documentTitle: payload.metadata[i]?.documentTitle || '',
      chunkIndex: payload.metadata[i]?.chunkIndex ?? -1, tags: payload.metadata[i]?.tags || [], createdAt: new Date().toISOString(),
    }));
    const ids = await db.vectors.bulkAdd(items, { allKeys: true });
    this.vectors = payload.vectors;
    this.metadata = payload.metadata.map((m, i) => ({ ...m, index: ids[i] }));
    for (let i = 0; i < this.vectors.length; i++) this.hnsw.insert(this.vectors[i], i);
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
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  na = Math.sqrt(na); nb = Math.sqrt(nb);
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
}

let storeInstance = null;

export async function getVectorStore() {
  if (!storeInstance) { storeInstance = new VectorStore(); await storeInstance.init(); }
  return storeInstance;
}

export { VectorStore, HNSWIndex };