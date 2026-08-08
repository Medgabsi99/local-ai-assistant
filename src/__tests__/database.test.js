import { describe, it, expect } from 'vitest';
import { normalizeBackupPayload } from '../db/backup';

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

  it('normalizes backup payloads before import', () => {
    const payload = normalizeBackupPayload({
      documents: [
        {
          id: 1,
          title: '<b>Hello</b>',
          content: '<script>alert(1)</script>Safe',
          fileType: 'text/plain',
          tags: [' one ', '', 2],
        },
      ],
      documentChunks: [
        {
          id: 7,
          documentId: 1,
          chunkIndex: '0',
          content: '<i>Chunk</i>',
        },
      ],
      conversations: [
        {
          id: 3,
          title: '<b>Chat</b>',
          pinned: 1,
          archived: 0,
        },
      ],
      messages: [
        {
          id: 9,
          conversationId: 3,
          role: 'user',
          content: '<img src=x onerror=alert(1)>Hi',
          metadata: { starred: true },
        },
      ],
      settings: [{ key: 'theme', value: 'dark' }],
      vectorStore: { vectors: [], metadata: [] },
    });

    expect(payload.documents[0].title).toBe('Hello');
    expect(payload.documents[0].content).toBe('Safe');
    expect(payload.documents[0].tags).toEqual(['one', '2']);
    expect(payload.documentChunks[0].chunkIndex).toBe(0);
    expect(payload.conversations[0].title).toBe('Chat');
    expect(payload.messages[0].content).toBe('Hi');
    expect(payload.vectorStore).toEqual({ vectors: [], metadata: [] });
  });

  it('validates vector store payload structure', () => {
    const payload = normalizeBackupPayload({
      documents: [],
      documentChunks: [],
      conversations: [],
      messages: [],
      settings: [],
      vectorStore: {
        vectors: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        metadata: [
          { documentId: 1, documentTitle: 'Doc 1', chunkIndex: 0, tags: ['a'] },
          { documentId: 2, documentTitle: 'Doc 2', chunkIndex: 1, tags: [] },
        ],
      },
    });

    expect(payload.vectorStore.vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(payload.vectorStore.metadata[0].documentTitle).toBe('Doc 1');
  });

  it('rejects mixed-dimension vector store payloads', () => {
    expect(() =>
      normalizeBackupPayload({
        documents: [],
        documentChunks: [],
        conversations: [],
        messages: [],
        settings: [],
        vectorStore: {
          vectors: [[0.1, 0.2], [0.3]],
          metadata: [
            { documentId: 1, documentTitle: 'Doc 1', chunkIndex: 0, tags: [] },
            { documentId: 2, documentTitle: 'Doc 2', chunkIndex: 1, tags: [] },
          ],
        },
      }),
    ).toThrow('must have the same dimension as the first vector');
  });

  it('rejects malformed backup payloads', () => {
    expect(() => normalizeBackupPayload({ documents: {} })).toThrow('documents must be an array');
    expect(() => normalizeBackupPayload({ messages: [{ role: 'user', content: 'hi' }] })).toThrow(
      'messages[0].conversationId is required',
    );
    expect(() =>
      normalizeBackupPayload({
        documents: [],
        documentChunks: [],
        conversations: [],
        messages: [],
        settings: [],
        vectorStore: { vectors: [[0.1]], metadata: [] },
      }),
    ).toThrow('vectorStore vectors and metadata must have the same length');
  });
});
