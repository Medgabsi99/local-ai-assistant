import { describe, it, expect, beforeEach } from 'vitest';
import { HNSWIndex } from '../workers/vector-store';

describe('HNSWIndex', () => {
  let hnsw;

  beforeEach(() => {
    hnsw = new HNSWIndex();
  });

  describe('cosine similarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const result = hnsw.metric(a, b);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      const result = hnsw.metric(a, b);
      expect(result).toBeCloseTo(0.0, 5);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];
      const result = hnsw.metric(a, b);
      expect(result).toBeCloseTo(-1.0, 5);
    });

    it('handles zero vectors', () => {
      const a = [0, 0];
      const b = [1, 0];
      const result = hnsw.metric(a, b);
      expect(result).toBe(0);
    });
  });

  describe('insert and search', () => {
    it('inserts first element and sets enterpoint', () => {
      hnsw.insert([1, 0, 0], 0);
      expect(hnsw.enterpoint).toBe(0);
      expect(hnsw.data[0]).toEqual([1, 0, 0]);
    });

    it('inserts multiple elements', () => {
      hnsw.insert([1, 0, 0], 0);
      hnsw.insert([0, 1, 0], 1);
      hnsw.insert([0, 0, 1], 2);
      expect(hnsw.data.length).toBe(3);
    });

    it('search returns results sorted by similarity', () => {
      hnsw.insert([1, 0, 0], 0);
      hnsw.insert([0, 1, 0], 1);
      hnsw.insert([0, 0, 1], 2);
      const results = hnsw.search([1, 0, 0], 3);
      expect(results.length).toBe(3);
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      expect(results[0].node).toBe(0);
    });

    it('search returns empty array when no data', () => {
      const results = hnsw.search([1, 0, 0], 3);
      expect(results).toEqual([]);
    });

    it('search respects topK', () => {
      hnsw.insert([1, 0, 0], 0);
      hnsw.insert([0, 1, 0], 1);
      hnsw.insert([0, 0, 1], 2);
      const results = hnsw.search([1, 0, 0], 1);
      expect(results.length).toBe(1);
    });
  });

  describe('remove', () => {
    it('removes element by index', () => {
      hnsw.insert([1, 0, 0], 0);
      hnsw.insert([0, 1, 0], 1);
      hnsw.remove(0);
      expect(hnsw.data[0]).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all data', () => {
      hnsw.insert([1, 0, 0], 0);
      hnsw.clear();
      expect(hnsw.data.length).toBe(0);
      expect(hnsw.enterpoint).toBeNull();
    });
  });
});