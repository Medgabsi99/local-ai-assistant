// ============================================================
// Browser-Native Vector Store using OPFS
// ============================================================

const VECTOR_STORE_NAME = 'vectors';
const METADATA_STORE_NAME = 'vector-metadata';

class VectorStore {
  constructor() {
    this.vectors = [];
    this.metadata = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Try loading from OPFS
    try {
      const root = await navigator.storage.getDirectory();
      const vectorFile = await root.getFileHandle(VECTOR_STORE_NAME, {
        create: true,
      });
      const metadataFile = await root.getFileHandle(METADATA_STORE_NAME, {
        create: true,
      });

      // Read existing vectors
      try {
        const vFile = await vectorFile.getFile();
        const vText = await vFile.text();
        if (vText) {
          this.vectors = JSON.parse(vText);
        }
      } catch {
        this.vectors = [];
      }

      // Read existing metadata
      try {
        const mFile = await metadataFile.getFile();
        const mText = await mFile.text();
        if (mText) {
          this.metadata = JSON.parse(mText);
        }
      } catch {
        this.metadata = [];
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      this.vectors = [];
      this.metadata = [];
      this.initialized = true;
    }
  }

  async save() {
    try {
      const root = await navigator.storage.getDirectory();

      // Save vectors
      const vectorFile = await root.getFileHandle(VECTOR_STORE_NAME, {
        create: true,
      });
      const writable = await vectorFile.createWritable();
      await writable.write(JSON.stringify(this.vectors));
      await writable.close();

      // Save metadata
      const metadataFile = await root.getFileHandle(METADATA_STORE_NAME, {
        create: true,
      });
      const mWritable = await metadataFile.createWritable();
      await mWritable.write(JSON.stringify(this.metadata));
      await mWritable.close();
    } catch (error) {
      console.error('Failed to save vector store:', error);
    }
  }

  async addVector(embedding, metadata = {}) {
    await this.init();
    this.vectors.push(embedding);
    this.metadata.push({
      ...metadata,
      index: this.metadata.length,
      timestamp: new Date().toISOString(),
    });
    await this.save();
    return this.metadata.length - 1;
  }

  async addVectors(embeddings, metadatas = []) {
    await this.init();
    const startIndex = this.vectors.length;

    for (let i = 0; i < embeddings.length; i++) {
      this.vectors.push(embeddings[i]);
      this.metadata.push({
        ...(metadatas[i] || {}),
        index: startIndex + i,
        timestamp: new Date().toISOString(),
      });
    }

    await this.save();
    return startIndex;
  }

  // Cosine similarity search
  async search(queryEmbedding, topK = 5, minSimilarity = 0.3) {
    await this.init();

    if (this.vectors.length === 0) return [];

    const similarities = this.vectors.map((vec, index) => ({
      similarity: cosineSimilarity(queryEmbedding, vec),
      index,
      metadata: this.metadata[index],
    }));

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Filter and take top K
    return similarities
      .filter((s) => s.similarity >= minSimilarity)
      .slice(0, topK);
  }

  async clear() {
    this.vectors = [];
    this.metadata = [];
    await this.save();
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

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

// Singleton instance
let storeInstance = null;

export async function getVectorStore() {
  if (!storeInstance) {
    storeInstance = new VectorStore();
    await storeInstance.init();
  }
  return storeInstance;
}

export { VectorStore };
