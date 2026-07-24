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
 * Uses precise patterns with negative lookbehind to reject common false positives.
 * @param {string} content - The message content from user
 * @returns {string[]} - Array of memory facts
 */
export function extractMemories(content) {
  const memories = [];
  const lower = content.toLowerCase();

  // Each pattern requires the fact to be at least 15 characters total
  // and uses a negative lookahead blocklist to filter throwaway statements

  const patterns = [
    // "My name is X" — at least 3 chars for the name
    /\bmy\s+name\s+is\s+(\w{3,}(?:\s+\w+)?)\b/gi,

    // "I'm X" or "I am X" — but NOT followed by a verb or negation
    // Blocked: "I am not", "I am just", "I am going", "I am trying", "I am saying",
    //          "I am asking", "I am wondering", "I am thinking", "I am looking",
    //          "I am sure", "I am sorry", "I am happy/sad/glad"
    /\bI\s+(?:'m|am)\s+(?:(?:a|an)\s+)?(?!not\s|just\s|going\s|trying\s|saying\s|asking\s|wondering\s|thinking\s|looking\s|waiting\s|sure\s|sorry\s|happy\s|sad\s|glad\s|tired\s|ready\s|able\s|about\s|here\s|there\s|new\s|still\s|very\s|so\s|too\s)(\w{3,}(?:\s+\w+){0,3})\b/gi,

    // "I work|study as|at|in|for X" — must be a concrete role/place
    /\bI\s+(?:work|study)\s+(?:as|at|in|for)\s+(?!(?:a|an|the|this|that|here|there|it)\b)(\w{3,}(?:\s+\w+){0,3})/gi,

    // "I live|reside in X" — must be a place name (at least 3 chars)
    /\bI\s+(?:live|reside)\s+in\s+(\w{3,}(?:\s+\w+){0,2})\b/gi,

    // "I like|love|prefer|enjoy X" — but NOT "I like it|that|this|you|him|her|them"
    /\bI\s+(?:really\s+)?(?:like|love|prefer|enjoy)\s+(?!it\b|that\b|this\b|you\b|him\b|her\b|them\b|those\b|these\b)(\w{3,}(?:\s+\w+){0,3})/gi,

    // "I hate|dislike X"
    /\bI\s+(?:really\s+)?(?:hate|dislike)\s+(?!it\b|that\b|this\b|you\b|him\b|her\b|them\b)(\w{3,}(?:\s+\w+){0,3})/gi,

    // "My favorite X is Y"
    /\bmy\s+favorite\s+(\w{3,}(?:\s+\w+)?)\s+is\s+(\w{3,}(?:\s+\w+){0,2})/gi,

    // "I've been X for" or "I have been X for" — experience/role with duration
    /\bI\s+(?:have\s+been|'ve\s+been)\s+(?:(?:a|an)\s+)?(?!there\b|here\b|through\b)(\w{3,}(?:\s+\w+){0,3})\s+for\b/gi,

    // "I have X years of experience" — skill/experience
    /\bI\s+have\s+\d+\s+years?\s+of\s+(?:experience\s+(?:in|with)\s+)?(\w{3,}(?:\s+\w+){0,3})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const fact = match[0].trim();
      // Length filter: too short = likely a false positive
      if (fact.length < 15) continue;
      // Negation filter: contains a negation word = not a real fact
      if (
        /\b(?:don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|never|no\s+longer)\b/i.test(
          fact,
        )
      )
        continue;
      // Tense filter: "I am going to" or "I am trying to" = action, not fact
      if (/\b(?:going|trying|thinking|wondering|asking|telling|hoping|wanting|needing)\s+(?:to|about)\b/i.test(fact))
        continue;
      // Time qualifier: "right now", "today" = temporary, not factual
      if (/\b(?:right now|at the moment|today|this week|this month)\b/i.test(fact)) continue;

      memories.push(fact.charAt(0).toUpperCase() + fact.slice(1));
    }
  }

  return [...new Set(memories)];
}

function inferCategory(content) {
  const lower = content.toLowerCase();
  if (lower.includes('name')) return 'identity';
  if (lower.includes('live') || lower.includes('reside')) return 'location';
  if (
    lower.includes('work') ||
    lower.includes('study') ||
    lower.includes('job') ||
    lower.includes('experience') ||
    lower.includes('years of')
  )
    return 'work';
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
  if (lower.includes("'m") || lower.includes(' am ')) return 'trait';
  if (lower.includes('been')) return 'experience';
  return 'general';
}

export async function saveMemory(content) {
  const memDb = getDb();
  const existing = await memDb.memories.where('content').equals(content).count();
  if (existing > 0) return;
  return memDb.memories.add({
    content,
    category: inferCategory(content),
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  });
}

export async function getMemories(category = null) {
  const memDb = getDb();
  if (category) return memDb.memories.where('category').equals(category).toArray();
  return memDb.memories.toArray();
}

export async function deleteMemory(id) {
  const memDb = getDb();
  return memDb.memories.delete(id);
}

export async function clearMemories() {
  const memDb = getDb();
  return memDb.memories.clear();
}

export async function getMemorySummary() {
  const memories = await getMemories();
  if (memories.length === 0) return '';
  return memories.map((m) => m.content).join(' ');
}

export async function getMemoryCount() {
  const memDb = getDb();
  return memDb.memories.count();
}
