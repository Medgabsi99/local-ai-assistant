// ============================================================
// useConversationSearch — Full-text search across all conversations
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { getConversationMessages } from '../db/database';

export function useConversationSearch(conversations) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      if ((c.tags || []).some((tag) => tag.toLowerCase().includes(q))) return true;
      return searchResults.some((r) => r.conversationId === c.id);
    });
  }, [conversations, searchQuery, searchResults]);

  const performSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const q = query.toLowerCase().trim();
    const results = [];

    try {
      for (const conv of conversations) {
        const messages = await getConversationMessages(conv.id);
        for (const msg of messages) {
          if (msg.content.toLowerCase().includes(q)) {
            results.push({
              conversationId: conv.id,
              conversationTitle: conv.title,
              messageId: msg.id,
              role: msg.role,
              snippet: msg.content.slice(0, 150) + (msg.content.length > 150 ? '...' : ''),
              timestamp: msg.timestamp,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Conversation search error:', e);
    }

    setSearchResults(results);
    setSearching(false);
  }, [conversations]);

  return {
    searchQuery,
    setSearchQuery: performSearch,
    searchResults,
    filteredConversations,
    searching,
  };
}