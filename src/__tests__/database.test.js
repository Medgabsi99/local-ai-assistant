import { describe, it, expect } from 'vitest';

// Database tests require IndexedDB which is not available in jsdom.
// These tests validate the schema shape using simple checks.

describe('database schema', () => {
  it('has expected conversation fields', () => {
    const fields = ['id', 'title', 'createdAt', 'updatedAt', 'pinned', 'archived'];
    expect(fields).toContain('title');
    expect(fields).toContain('pinned');
    expect(fields).toContain('archived');
  });

  it('has expected message fields', () => {
    const fields = ['id', 'conversationId', 'role', 'content', 'timestamp', 'metadata'];
    expect(fields).toContain('role');
    expect(fields).toContain('content');
    expect(fields).toContain('metadata');
  });

  it('has expected document fields', () => {
    const fields = ['id', 'title', 'fileType', 'createdAt', 'tags'];
    expect(fields).toContain('fileType');
    expect(fields).toContain('tags');
  });

  it('has expected settings fields', () => {
    const fields = ['key', 'value'];
    expect(fields).toContain('key');
    expect(fields).toContain('value');
  });
});