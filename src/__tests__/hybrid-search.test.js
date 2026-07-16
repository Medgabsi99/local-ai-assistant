import { describe, it, expect } from 'vitest';
import { hybridSearch, textSearch } from '../lib/hybrid-search';

describe('hybridSearch', () => {
  const query = 'artificial intelligence machine learning';
  const chunks = [
    {
      content: 'Artificial intelligence is transforming how machines learn from data',
      metadata: { documentId: '1', chunkIndex: 0, documentTitle: 'AI' },
      similarity: 0.85,
    },
    {
      content: 'The weather today is sunny and warm',
      metadata: { documentId: '1', chunkIndex: 1, documentTitle: 'AI' },
      similarity: 0.1,
    },
    {
      content: 'Machine learning algorithms can process large datasets efficiently',
      metadata: { documentId: '1', chunkIndex: 2, documentTitle: 'AI' },
      similarity: 0.75,
    },
  ];

  it('returns matches sorted by hybrid score', async () => {
    const results = await hybridSearch(query, chunks, chunks, 0.6);
    expect(results).toHaveLength(3);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThanOrEqual(results[2].similarity);
  });

  it('gives higher score to chunks containing query terms', async () => {
    const results = await hybridSearch(query, chunks, chunks, 0.6);
    // First result should have "intelligence" or "learning" keywords
    const topContent = results[0].content.toLowerCase();
    const hasKeywords = topContent.includes('intelligence') || topContent.includes('learning');
    expect(hasKeywords).toBe(true);
  });

  it('includes bm25 and vector scores in results', async () => {
    const results = await hybridSearch(query, chunks, chunks, 0.6);
    expect(results[0]).toHaveProperty('bm25Score');
    expect(results[0]).toHaveProperty('vectorScore');
    expect(typeof results[0].bm25Score).toBe('number');
    expect(typeof results[0].vectorScore).toBe('number');
  });

  it('returns empty array for no matches', async () => {
    const result = await hybridSearch('xyz', [], [], 0.6);
    expect(result).toEqual([]);
  });

  it('returns original matches if chunks empty', async () => {
    const result = await hybridSearch('test', [], [{ similarity: 0.5 }], 0.6);
    expect(result).toHaveLength(1);
  });
});

describe('textSearch', () => {
  const texts = [
    'Deep learning is a subset of machine learning',
    'Cats are furry animals that purr',
    'Neural networks are used in deep learning',
  ];

  it('finds texts matching query terms', () => {
    const results = textSearch('deep learning', texts);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content.toLowerCase()).toContain('deep');
  });

  it('returns empty array for no matches', () => {
    const results = textSearch('quantum physics', texts);
    expect(results).toHaveLength(0);
  });

  it('sorts results by descending score', () => {
    const results = textSearch('learning', texts);
    if (results.length > 1) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });

  it('filters out zero-score results', () => {
    const results = textSearch('xyznonexistent', texts);
    const allPositive = results.every((r) => r.score > 0);
    expect(allPositive).toBe(true);
  });
});
