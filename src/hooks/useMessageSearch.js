import { useState, useMemo, useEffect, useRef } from 'react';

export function useMessageSearch(messages, showSearch, setShowSearch) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [filterRole, setFilterRole] = useState('all'); // 'all' | 'user' | 'assistant'
  const searchInputRef = useRef(null);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim() && filterRole === 'all') return messages;
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((m) => {
      // Role filter
      if (filterRole !== 'all' && m.role !== filterRole) return false;
      // Text search
      if (!q) return true;
      if (m.content.toLowerCase().includes(q)) return true;
      const meta = m.metadata || {};
      if (meta.model?.toLowerCase().includes(q)) return true;
      if (meta.contextSources?.some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [messages, searchQuery, filterRole]);

  const searchResults = searchQuery.trim() ? filteredMessages : [];
  const activeSearchId = searchResults.length > 0 ? searchResults[searchIndex]?.id : null;

  // Count total matches across all messages
  const totalMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const q = searchQuery.toLowerCase();
    let count = 0;
    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      let idx = 0;
      while ((idx = content.indexOf(q, idx)) !== -1) {
        count++;
        idx += q.length;
      }
    }
    return count;
  }, [messages, searchQuery]);

  // Get highlight ranges for a message
  function getHighlights(text) {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const lower = text.toLowerCase();
    const ranges = [];
    let idx = 0;
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      ranges.push({ start: idx, end: idx + q.length });
      idx += q.length;
    }
    return ranges;
  }

  // Get preview snippet around first match
  function getSnippet(text) {
    if (!searchQuery.trim()) return text;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + q.length + 60);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }

  useEffect(() => {
    if (activeSearchId) {
      const el = document.getElementById(`msg-${activeSearchId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSearchId, searchIndex]);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Keyboard shortcut: Ctrl+F to toggle, Escape to close
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch((s) => !s);
        if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch, setShowSearch]);

  return {
    searchQuery,
    setSearchQuery,
    searchIndex,
    setSearchIndex,
    filterRole,
    setFilterRole,
    filteredMessages,
    searchResults,
    activeSearchId,
    totalMatchCount,
    getHighlights,
    getSnippet,
    searchInputRef,
  };
}
