// ============================================================
// Hybrid Search: Real BM25 + Vector similarity re-ranking
// BM25 uses corpus-wide document frequency statistics
// ============================================================

import { RAG_VECTOR_WEIGHT } from './constants';

// Build a corpus index: for each term, how many documents contain it
function buildCorpusIndex(chunks) {
  const df = {}; // document frequency: term → number of docs containing it
  const totalDocs = chunks.length;

  for (const chunk of chunks) {
    const terms = new Set(chunk.content.toLowerCase().split(/\s+/).filter(Boolean));
    for (const term of terms) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  return { df, totalDocs };
}

// Real BM25 with corpus-wide IDF
function bm25(query, document, corpusIndex, avgDocLength, k1 = 1.5, b = 0.75) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const docTerms = document.toLowerCase().split(/\s+/).filter(Boolean);
  const docLength = docTerms.length;
  const { df, totalDocs } = corpusIndex;

  // Term frequency in document
  const tf = {};
  for (const term of docTerms) {
    tf[term] = (tf[term] || 0) + 1;
  }

  let score = 0;
  for (const term of queryTerms) {
    if (tf[term]) {
      // Real IDF: log(1 + (N - n + 0.5) / (n + 0.5))
      const n = df[term] || 0;
      const idf = Math.log(1 + (totalDocs - n + 0.5) / (n + 0.5));

      const numerator = tf[term] * (k1 + 1);
      const denominator = tf[term] + k1 * (1 - b + b * (docLength / avgDocLength));
      score += idf * (numerator / denominator);
    }
  }

  return score;
}

// Normalize a value between 0 and 1
function normalize(values) {
  if (values.length === 0) return values;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

// Hybrid search: combine BM25 + vector similarity with re-ranking
export async function hybridSearch(query, chunks, matches, vectorWeight = RAG_VECTOR_WEIGHT) {
  if (!matches?.length || !chunks?.length) return matches || [];

  // Build corpus index from ALL chunks for real IDF
  const corpusIndex = buildCorpusIndex(chunks);
  const avgDocLength =
    chunks.reduce((sum, c) => sum + (c.content || '').split(/\s+/).filter(Boolean).length, 0) / chunks.length;

  // Get content for each match
  const matchContents = [];
  for (const match of matches) {
    const chunk = chunks.find(
      (c) =>
        c.metadata?.chunkIndex === match.metadata?.chunkIndex && c.metadata?.documentId === match.metadata?.documentId,
    );
    matchContents.push(chunk?.content || '');
  }

  // Calculate real BM25 scores using corpus statistics
  const bm25Scores = matchContents.map((content) => bm25(query, content, corpusIndex, avgDocLength));

  // Get vector similarity scores
  const vectorScores = matches.map((m) => m.similarity || 0);

  // Normalize both score sets
  const normBM25 = normalize(bm25Scores);
  const normVector = normalize(vectorScores);

  // Calculate hybrid scores
  const hybridScores = matches.map((match, i) => ({
    ...match,
    bm25Score: normBM25[i],
    vectorScore: normVector[i],
    similarity: normBM25[i] * (1 - vectorWeight) + normVector[i] * vectorWeight,
  }));

  // Sort by hybrid score (descending)
  hybridScores.sort((a, b) => b.similarity - a.similarity);

  return hybridScores;
}

// BM25-only text search (for when no vectors available)
export function textSearch(query, texts) {
  if (!texts.length) return [];
  const chunks = texts.map((content) => ({ content }));
  const corpusIndex = buildCorpusIndex(chunks);
  const avgDocLength = texts.reduce((sum, t) => sum + t.split(/\s+/).filter(Boolean).length, 0) / texts.length;

  const scores = texts.map((text) => ({
    content: text,
    score: bm25(query, text, corpusIndex, avgDocLength),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.filter((s) => s.score > 0);
}
