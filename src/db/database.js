import Dexie from 'dexie';

class LocalAIDatabase extends Dexie {
  constructor() {
    super('LocalAIDB');

    this.version(1).stores({
      documents: '++id, title, content, createdAt, updatedAt, fileType',
      conversations: '++id, title, createdAt, updatedAt',
      messages: '++id, conversationId, role, content, timestamp, metadata',
      settings: 'key',
    });
  }
}

export const db = new LocalAIDatabase();

// Helper functions
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

export async function getAllDocuments() {
  return db.documents.orderBy('updatedAt').reverse().toArray();
}

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

export async function getSetting(key) {
  return db.settings.get(key);
}

export async function setSetting(key, value) {
  return db.settings.put({ key, value });
}
