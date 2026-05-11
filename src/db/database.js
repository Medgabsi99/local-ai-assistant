import Dexie from 'dexie';

class LocalAIDatabase extends Dexie {
  constructor() {
    super('LocalAIDB');

    this.version(2).stores({
      documents: '++id, title, fileType, createdAt, updatedAt',
      documentChunks: '++id, documentId, chunkIndex',
      conversations: '++id, title, createdAt, updatedAt',
      messages: '++id, conversationId, role, content, timestamp, metadata',
      settings: 'key',
    });
  }
}

export const db = new LocalAIDatabase();

// Document helpers
export async function saveDocument({ title, content, fileType = 'text/plain' }) {
  const now = new Date().toISOString();
  return db.documents.add({
    title,
    content,
    fileType,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateDocument(id, updates) {
  return db.documents.update(id, {
    ...updates,
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
  return db.documentChunks
    .where('documentId')
    .equals(documentId)
    .sortBy('chunkIndex');
}

export async function getAllChunks() {
  return db.documentChunks.toArray();
}

// Conversation helpers
export async function createConversation(title = 'New Chat') {
  const now = new Date().toISOString();
  return db.conversations.add({
    title,
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

export async function getConversationMessages(conversationId) {
  return db.messages
    .where('conversationId')
    .equals(conversationId)
    .sortBy('timestamp');
}

export async function getAllConversations() {
  return db.conversations.orderBy('updatedAt').reverse().toArray();
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

