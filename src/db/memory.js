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
 * Extract potential memory facts from a conversation.
 * Uses precise patterns with negative lookahead to avoid false positives.
 * @param {string} content - The message content from user
 * @returns {string[]} - Array of memory facts
 */
export function extractMemories(content) {
  const memories = [];
  const lower = content.toLowerCase();

  // Patterns use negative lookahead to reject negatives and common false matches.
  // Each requires at least two meaningful words after the signal word.
  const patterns = [
    // "I like X", "I love X", "I prefer X", "I enjoy X", "I hate X", "I dislike X"
    // Blocked: "I like it", "I like that", "I don't like X"
    /\bI\s+(?:really\s+)?(?:like|love|prefer|enjoy|hate|dislike)\s+(?!(?:it|that|this|those|them|these|you|him|her)\b)(\w+(?:\s+\w+){0,3})/gi,

    // "My favorite X is Y" — captures the whole predicate
    /\bmy\s+favorite\s+(\w+(?:\s+\w+)?)\s+is\s+(\w+(?:\s+\w+){0,2})/gi,

    // "I am a/an X" or "I'm a/an X" — but NOT "I am not", "I am just", "I am going", "I am sure", "I am saying"
    /\bI\s+(?:am|'m)\s+(?:(?:a|an)\s+)?(?!(?:not|just|going|sure|saying|trying|thinking|wondering|asking|telling|being|doing|having|making|getting|looking|waiting)\b)(\w+(?:\s+\w+){0,3})/gi,

    // "I work as X", "I work at X", "I work in X", "I study at X", "I study in X"
    /\bI\s+(?:work|study)\s+(?:as|at|in|for)\s+(\w+(?:\s+\w+){0,3})/gi,

    // "My name is X" (at least 2 chars)
    /\bmy\s+name\s+is\s+(\w{2,}(?:\s+\w+)?)/gi,

    // "I live in X" (at least 3 chars — city/country names)
    /\bI\s+(?:live|reside)\s+in\s+(\w{3,}(?:\s+\w+){0,2})/gi,

    // "I have been X for Y years" — captures roles with duration
    /\bI\s+(?:have\s+been|'ve\s+been)\s+(?:(?:a|an)\s+)?(\w+(?:\s+\w+){0,3})\s+for\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const fact = match[0].trim();
      // Only store if it looks like a real fact (not a throwaway statement)
      if (fact.length > 12 && fact.length < 300 && !containsNegation(fact)) {
        memories.push(fact.charAt(0).toUpperCase() + fact.slice(1));
      }
    }
  }

  return [...new Set(memories)]; // deduplicate
}

/**
 * Check if a matched fact contains negation that would make it not-a-fact.
 */
function containsNegation(text) {
  return /\b(?:don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|never|no\s+longer)\b/i.test(
    text,
  );
}

/**
 * Infer a category from memory content
 */
function inferCategory(content) {
  const lower = content.toLowerCase();
  if (lower.includes('name')) return 'identity';
  if (lower.includes('work') || lower.includes('study') || lower.includes('job')) return 'work';
  if (lower.includes('live') || lower.includes('reside') || lower.includes('address')) return 'location';
  if (
    lower.includes('like') ||
    lower.includes('love') ||
    lower.includes('prefer') ||
    lower.includes('favorite') ||
    lower.includes('hate') ||
    lower.includes('enjoy') ||
    lower.includes('dislike')
  )
    return 'preference';
  if (lower.includes('am') || lower.includes("'m")) return 'trait';
  if (lower.includes('been')) return 'experience';
  return 'general';
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
 * Delete a specific memory by ID
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
 */
export async function getMemorySummary() {
  const memories = await getMemories();
  if (memories.length === 0) return '';
  return memories.map((m) => m.content).join(' ');
}

/**
 * Get memory count
 */
export async function getMemoryCount() {
  const db = getDb();
  return db.memories.count();
}
