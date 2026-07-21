import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../db/database', () => ({
  getConversationMessages: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue(1),
  deleteMessage: vi.fn().mockResolvedValue(undefined),
  toggleMessageStar: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/i18n', () => ({
  t: (key) => {
    const map = {
      app_name: 'Local AI',
      all_data_device: 'All data stays on your device',
      no_messages: 'Send a message to start chatting',
      copy: 'Copy',
      stop_generation: 'Stop generation',
      scroll_to_bottom: 'Scroll to bottom',
      search_messages: 'Search messages...',
      send: 'Send',
      cancel_label: 'Cancel',
      save_send: 'Save & Send',
      bold: 'Bold',
      italic: 'Italic',
      code: 'Code',
      link: 'Link',
      list: 'List',
      code_block: 'Code block',
      markdown: 'Markdown',
      del: 'Delete',
      edit: 'Edit',
      read_aloud: 'Read aloud',
      star: 'Star',
      unstar: 'Unstar',
      sources: 'Sources:',
      pause: 'Pause',
      stop: 'Stop',
      resume: 'Resume',
      record_cancel: 'Cancel',
      transcribing: 'Transcribing...',
      type_message: 'Type a message...',
      ask_documents: 'Ask about your documents...',
      upload: 'Upload',
    };
    return map[key] || key;
  },
}));

vi.mock('../App', () => ({
  useToast: () => vi.fn(),
  useModelStatus: () => ({ anyLoading: false, embeddingModelReady: false }),
}));

vi.mock('../hooks/useChatSend', () => ({
  useChatSend: () => ({
    isGenerating: false,
    streamingContent: '',
    setStreamingContent: vi.fn(),
    handleSend: vi.fn(),
    generateReply: vi.fn(),
    stopGeneration: vi.fn(),
  }),
}));

vi.mock('../hooks/useMessageSearch', () => ({
  useMessageSearch: () => ({
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchIndex: 0,
    setSearchIndex: vi.fn(),
    filterRole: 'all',
    setFilterRole: vi.fn(),
    filteredMessages: [],
    searchResults: [],
    activeSearchId: null,
    totalMatchCount: 0,
    getSnippet: vi.fn(),
    searchInputRef: { current: null },
  }),
}));

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
    systemPrompt: '',
    saveSystemPrompt: vi.fn(),
  }),
}));

vi.mock('../workers/worker-bridge', () => ({
  ai: { cancelInference: vi.fn() },
}));

vi.mock('../lib/error-handler', () => ({
  reportError: vi.fn(),
}));

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

import { render, screen } from '@testing-library/react';
import ChatArea from '../components/ChatArea';

describe('ChatArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no conversation selected', () => {
    render(<ChatArea conversationId={null} />);
    expect(screen.getByText('Local AI')).toBeDefined();
    expect(screen.getByText('All data stays on your device')).toBeDefined();
  });

  it('shows empty messages state when conversation has no messages', () => {
    render(<ChatArea conversationId={1} />);
    expect(screen.getByText('Send a message to start chatting')).toBeDefined();
  });

  it('does not render markdown buttons in empty state', () => {
    render(<ChatArea conversationId={null} />);
    // The empty state has no markdown formatting toolbar
    expect(screen.queryByText('Markdown')).toBeNull();
  });
});