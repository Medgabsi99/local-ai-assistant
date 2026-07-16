import Dexie from 'dexie';
import { getVectorStore } from '../lib/vector-store-access';

class LocalAIDatabase extends Dexie {
  constructor() {
    super('LocalAIDB');

    this.version(4).stores({
      documents: '++id, title, fileType, createdAt, updatedAt, *tags',
      documentChunks: '++id, documentId, chunkIndex',
      conversations: '++id, title, createdAt, updatedAt, pinned',
      messages: '++id, conversationId, role, content, timestamp, metadata',
      settings: 'key',
    });
  }
}

export const db = new LocalAIDatabase();

// Document helpers
export async function saveDocument({ title, content, fileType = 'text/plain', tags = [] }) {
  const now = new Date().toISOString();
  return db.documents.add({
    title,
    content,
    fileType,
    tags: normalizeTags(tags),
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateDocument(id, updates) {
  return db.documents.update(id, {
    ...updates,
    ...(updates.tags ? { tags: normalizeTags(updates.tags) } : {}),
    updatedAt: new Date().toISOString(),
  });
}

export async function getAllDocuments() {
  return db.documents.orderBy('updatedAt').reverse().toArray();
}

export async function getDocument(id) {
  return db.documents.get(id);
}

export async function deleteDocument(id) {
  await db.documentChunks.where('documentId').equals(id).delete();
  return db.documents.delete(id);
}

export async function deleteDocumentVectors(id) {
  const store = await getVectorStore();
  await store.deleteVectorsByDocumentId(id);
}

export async function exportAppData() {
  const [documents, documentChunks, conversations, messages, settings] = await Promise.all([
    db.documents.toArray(),
    db.documentChunks.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.settings.toArray(),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    documents,
    documentChunks,
    conversations,
    messages,
    settings,
  };
}

export async function importAppData(payload) {
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const documentChunks = Array.isArray(payload?.documentChunks) ? payload.documentChunks : [];
  const conversations = Array.isArray(payload?.conversations) ? payload.conversations : [];
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const settings = Array.isArray(payload?.settings) ? payload.settings : [];

  await db.transaction('rw', db.documents, db.documentChunks, db.conversations, db.messages, db.settings, async () => {
    await Promise.all([
      db.documents.clear(),
      db.documentChunks.clear(),
      db.conversations.clear(),
      db.messages.clear(),
      db.settings.clear(),
    ]);

    if (documents.length > 0) {
      await db.documents.bulkPut(documents);
    }

    if (documentChunks.length > 0) {
      await db.documentChunks.bulkPut(documentChunks);
    }

    if (conversations.length > 0) {
      await db.conversations.bulkPut(conversations);
    }

    if (messages.length > 0) {
      await db.messages.bulkPut(messages);
    }

    if (settings.length > 0) {
      await db.settings.bulkPut(settings);
    }
  });
}

// Document chunk helpers
export async function saveDocumentChunks(documentId, chunks) {
  const items = chunks.map((content, index) => ({
    documentId,
    chunkIndex: index,
    content,
  }));
  return db.documentChunks.bulkAdd(items);
}

export async function getDocumentChunks(documentId) {
  return db.documentChunks.where('documentId').equals(documentId).sortBy('chunkIndex');
}

export async function getAllChunks() {
  return db.documentChunks.toArray();
}

// Conversation helpers
export async function createConversation(title = 'New Chat') {
  const now = new Date().toISOString();
  return db.conversations.add({
    title,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function addMessage(conversationId, role, content, metadata = {}) {
  await db.conversations.update(conversationId, {
    updatedAt: new Date().toISOString(),
  });
  return db.messages.add({
    conversationId,
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

export async function deleteMessage(id) {
  return db.messages.delete(id);
}

export async function getConversationMessages(conversationId) {
  return db.messages.where('conversationId').equals(conversationId).sortBy('timestamp');
}

export async function getAllConversations() {
  const conversations = await db.conversations.toArray();

  return conversations.sort((a, b) => {
    const pinnedDifference = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinnedDifference !== 0) return pinnedDifference;

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function deleteConversation(id) {
  await db.messages.where('conversationId').equals(id).delete();
  return db.conversations.delete(id);
}

// Settings helpers
export async function getSetting(key) {
  return db.settings.get(key);
}

export async function setSetting(key, value) {
  return db.settings.put({ key, value });
}

export async function updateConversationTitle(id, title) {
  return db.conversations.update(id, {
    title,
    updatedAt: new Date().toISOString(),
  });
}

export async function toggleMessageStar(id) {
  const msg = await db.messages.get(id);
  if (!msg) return;
  const starred = !msg.metadata?.starred;
  return db.messages.update(id, {
    metadata: { ...(msg.metadata || {}), starred },
  });
}

export async function toggleConversationPinned(id, pinned) {
  return db.conversations.update(id, {
    pinned: Boolean(pinned),
    updatedAt: new Date().toISOString(),
  });
}

export async function archiveConversation(id, archived = true) {
  return db.conversations.update(id, { archived, updatedAt: new Date().toISOString() });
}

export async function getAllActiveConversations() {
  const all = await db.conversations.toArray();
  return all
    .filter((c) => !c.archived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20);
}
