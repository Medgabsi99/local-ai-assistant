import { sanitizeText, sanitizeTitle } from '../lib/security';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureArray(value, fieldName) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an array`);
  }
  return value;
}

function ensureString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string`);
  }
  return value;
}

function normalizeTags(tags) {
  return ensureArray(tags, 'documents[].tags')
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeTimestamp(value, fallback) {
  return typeof value === 'string' && value ? value : fallback;
}

function normalizeId(item) {
  return item.id === undefined ? {} : { id: item.id };
}

function normalizeDocument(item, index, now) {
  if (!isPlainObject(item)) {
    throw new TypeError(`documents[${index}] must be an object`);
  }

  return {
    ...normalizeId(item),
    title: sanitizeTitle(ensureString(item.title, `documents[${index}].title`)),
    content: sanitizeText(ensureString(item.content, `documents[${index}].content`)),
    fileType: typeof item.fileType === 'string' && item.fileType.trim() ? item.fileType.trim() : 'text/plain',
    tags: normalizeTags(item.tags),
    createdAt: normalizeTimestamp(item.createdAt, now),
    updatedAt: normalizeTimestamp(item.updatedAt, now),
  };
}

function normalizeDocumentChunk(item, index) {
  if (!isPlainObject(item)) {
    throw new TypeError(`documentChunks[${index}] must be an object`);
  }

  const chunkIndex = Number(item.chunkIndex);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new TypeError(`documentChunks[${index}].chunkIndex must be a non-negative integer`);
  }

  return {
    ...normalizeId(item),
    documentId: item.documentId,
    chunkIndex,
    content: sanitizeText(ensureString(item.content, `documentChunks[${index}].content`)),
  };
}

function normalizeConversation(item, index, now) {
  if (!isPlainObject(item)) {
    throw new TypeError(`conversations[${index}] must be an object`);
  }

  return {
    ...normalizeId(item),
    title: sanitizeTitle(ensureString(item.title, `conversations[${index}].title`)),
    pinned: Boolean(item.pinned),
    archived: Boolean(item.archived),
    createdAt: normalizeTimestamp(item.createdAt, now),
    updatedAt: normalizeTimestamp(item.updatedAt, now),
  };
}

function normalizeMessage(item, index) {
  if (!isPlainObject(item)) {
    throw new TypeError(`messages[${index}] must be an object`);
  }

  if (!item.conversationId) {
    throw new TypeError(`messages[${index}].conversationId is required`);
  }

  return {
    ...normalizeId(item),
    conversationId: item.conversationId,
    role: ensureString(item.role, `messages[${index}].role`),
    content: sanitizeText(ensureString(item.content, `messages[${index}].content`)),
    timestamp: normalizeTimestamp(item.timestamp, new Date().toISOString()),
    metadata: isPlainObject(item.metadata) ? item.metadata : {},
  };
}

function normalizeSetting(item, index) {
  if (!isPlainObject(item)) {
    throw new TypeError(`settings[${index}] must be an object`);
  }

  return {
    ...normalizeId(item),
    key: ensureString(item.key, `settings[${index}].key`),
    value: item.value,
  };
}

function normalizeVectorStore(value) {
  if (value == null) return undefined;
  if (!isPlainObject(value)) {
    throw new TypeError('vectorStore must be an object');
  }

  const vectors = ensureArray(value.vectors, 'vectorStore.vectors');
  const metadata = ensureArray(value.metadata, 'vectorStore.metadata');
  if (vectors.length !== metadata.length) {
    throw new TypeError('vectorStore vectors and metadata must have the same length');
  }

  if (vectors.length === 0) {
    return { vectors: [], metadata: [] };
  }

  const expectedDimension = vectors[0]?.length;
  if (!Number.isInteger(expectedDimension) || expectedDimension <= 0) {
    throw new TypeError('vectorStore vectors must be non-empty arrays');
  }

  return {
    vectors: vectors.map((embedding, index) =>
      normalizeEmbedding(embedding, `vectorStore.vectors[${index}]`, expectedDimension),
    ),
    metadata: metadata.map((item, index) => normalizeVectorMetadata(item, index)),
  };
}

function normalizeEmbedding(embedding, fieldName, expectedDimension) {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty array`);
  }

  const values = embedding.map((value, index) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new TypeError(`${fieldName}[${index}] must be a finite number`);
    }
    return number;
  });

  if (Number.isInteger(expectedDimension) && values.length !== expectedDimension) {
    throw new TypeError(`${fieldName} must have the same dimension as the first vector`);
  }

  return values;
}

function normalizeVectorMetadata(item, index) {
  if (!isPlainObject(item)) {
    throw new TypeError(`vectorStore.metadata[${index}] must be an object`);
  }

  return {
    documentId: item.documentId ?? null,
    documentTitle: typeof item.documentTitle === 'string' ? item.documentTitle : '',
    chunkIndex: Number.isInteger(item.chunkIndex) ? item.chunkIndex : -1,
    tags: Array.isArray(item.tags)
      ? item.tags
          .map((tag) => String(tag).trim())
          .filter(Boolean)
          .slice(0, 20)
      : [],
    index: item.index,
  };
}

export function normalizeBackupPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new TypeError('Backup payload must be an object');
  }

  const now = new Date().toISOString();

  return {
    schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 1,
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : now,
    documents: ensureArray(payload.documents, 'documents').map((item, index) => normalizeDocument(item, index, now)),
    documentChunks: ensureArray(payload.documentChunks, 'documentChunks').map((item, index) =>
      normalizeDocumentChunk(item, index),
    ),
    conversations: ensureArray(payload.conversations, 'conversations').map((item, index) =>
      normalizeConversation(item, index, now),
    ),
    messages: ensureArray(payload.messages, 'messages').map((item, index) => normalizeMessage(item, index)),
    settings: ensureArray(payload.settings, 'settings').map((item, index) => normalizeSetting(item, index)),
    vectorStore: normalizeVectorStore(payload.vectorStore),
  };
}
