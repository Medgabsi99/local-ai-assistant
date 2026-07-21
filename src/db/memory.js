// ============================================================
// Multi-Session Persistent Memory
// Stores facts the AI learns about the user across conversations
// Memories are automatically injected into the system prompt
// ============================================================

import Dexie from 'dexie';

const MEMORY_DB_NAME = 'LocalAIMemory';

class MemoryDB extends Dexie {
  constructor() {
    super(MEMORY_DB_NAME);
    this.version(1).stores({
      memories: '++id, category, createdAt',
    });
  }
}

let db = null;

function getDb() {
  if (!db) db = new MemoryDB();
  return db;
}

/**
 * Extract potential memory facts from a conversation
 * @param {string} content - The message content from user
 * @returns {string[]} - Array of memory facts
 */
export function extractMemories(content) {
  const memories = [];
  const lower = content.toLowerCase();

  // Preference patterns
  const preferencePatterns = [
    /i (?:like|love|prefer|enjoy|hate|dislike) (\w+(?:\s+\w+)?)/gi,
    /(?:my|our) favorite (\w+(?:\s+\w+)?)/gi,
    /i (?:am|'m) (?:a |an )?(\w+(?:\s+\w+)?)/gi,
    /i (?:work|study) (?:as|at|in|with) (\w+(?:\s+\w+)?)/gi,
    /my name is (\w+)/gi,
    /i (?:live|reside) in (\w+(?:\s+\w+)?)/gi,
  ];

  for (const pattern of preferencePatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const fact = match[0].trim();
      if (fact.length > 10 && fact.length < 200) {
        memories.push(fact.charAt(0).toUpperCase() + fact.slice(1));
      }
    }
  }

  return memories;
}

/**
 * Save a memory fact to persistent storage
 */
export async function saveMemory(content) {
  const db = getDb();
  const existing = await db.memories.where('content').equals(content).count();
  if (existing > 0) return; // Deduplicate
  return db.memories.add({
    content,
    category: inferCategory(content),
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  });
}

/**
 * Infer a category from memory content
 */
function inferCategory(content) {
  const lower = content.toLowerCase();
  if (lower.includes('name')) return 'identity';
  if (lower.includes('work') || lower.includes('study') || lower.includes('job')) return 'work';
  if (lower.includes('live') || lower.includes('reside') || lower.includes('address')) return 'location';
  if (lower.includes('like') || lower.includes('love') || lower.includes('prefer') || lower.includes('favorite') || lower.includes('hate')) return 'preference';
  if (lower.includes('am') || lower.includes('are') || lower.includes('is')) return 'trait';
  return 'general';
}

/**
 * Get all memories, optionally filtered by category
 */
export async function getMemories(category = null) {
  const db = getDb();
  if (category) {
    return db.memories.where('category').equals(category).toArray();
  }
  return db.memories.toArray();
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(id) {
  const db = getDb();
  return db.memories.delete(id);
}

/**
 * Clear all memories
 */
export async function clearMemories() {
  const db = getDb();
  return db.memories.clear();
}

/**
 * Get memory summary text for injection into system prompt
 * Returns a formatted string like:
 * "User context: I like cats. I work as a developer. My name is John."
 */
export async function getMemorySummary() {
  const memories = await getMemories();
  if (memories.length === 0) return '';
  const statements = memories.map((m) => m.content);
  return statements.join(' ');
}

/**
 * Get memory count
 */
export async function getMemoryCount() {
  const db = getDb();
  return db.memories.count();
}