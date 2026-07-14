// ============================================================
// Hybrid Search: BM25 + Vector similarity re-ranking
// ============================================================

// Simple BM25 implementation for keyword scoring
function bm25(query, document, k1 = 1.5, b = 0.75) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const docTerms = document.toLowerCase().split(/\s+/).filter(Boolean);
  const docLength = docTerms.length;
  const avgDocLength = 200; // approximate average chunk length
  
  // Term frequency in document
  const tf = {};
  for (const term of docTerms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  
  // Document frequency (inverse) — approximated
  // In a full implementation you'd track DF across all docs
  const idf = {};
  for (const term of queryTerms) {
    // Approximate IDF: rarer terms get higher weight
    const freq = tf[term] || 0;
    idf[term] = Math.log(1 + (1 / (1 + freq)));
  }
  
  let score = 0;
  for (const term of queryTerms) {
    if (tf[term]) {
      const numerator = tf[term] * (k1 + 1);
      const denominator = tf[term] + k1 * (1 - b + b * (docLength / avgDocLength));
      score += idf[term] * (numerator / denominator);
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
  return values.map(v => (v - min) / (max - min));
}

// Hybrid search: combine BM25 + vector similarity with re-ranking
export async function hybridSearch(query, chunks, matches, vectorWeight = 0.6) {
  if (!matches?.length || !chunks?.length) return matches || [];
  
  // Get content for each match
  const matchContents = [];
  for (const match of matches) {
    const chunk = chunks.find(
      c => c.metadata?.chunkIndex === match.metadata?.chunkIndex && 
           c.metadata?.documentId === match.metadata?.documentId
    );
    matchContents.push(chunk?.content || '');
  }
  
  // Calculate BM25 scores
  const bm25Scores = matchContents.map(content => bm25(query, content));
  
  // Get vector similarity scores
  const vectorScores = matches.map(m => m.similarity || 0);
  
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
  const scores = texts.map(text => ({
    content: text,
    score: bm25(query, text),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.filter(s => s.score > 0);
}