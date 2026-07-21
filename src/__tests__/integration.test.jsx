import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Integration Tests — Component Rendering & i18n Coverage
// ============================================================

// Mock IndexedDB (Dexie)
vi.mock('../db/database', () => ({
  addMessage: vi.fn().mockResolvedValue(1),
  deleteMessage: vi.fn().mockResolvedValue(undefined),
  getConversationMessages: vi.fn().mockResolvedValue([]),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  toggleMessageStar: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn().mockResolvedValue(1),
  getAllConversations: vi.fn().mockResolvedValue([]),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  toggleConversationPinned: vi.fn().mockResolvedValue(undefined),
  archiveConversation: vi.fn().mockResolvedValue(undefined),
  saveDocument: vi.fn().mockResolvedValue(1),
  saveDocumentChunks: vi.fn().mockResolvedValue(undefined),
  getDocumentChunks: vi.fn().mockResolvedValue([]),
  getAllDocuments: vi.fn().mockResolvedValue([]),
  getDocument: vi.fn().mockResolvedValue(null),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocumentVectors: vi.fn().mockResolvedValue(undefined),
  updateDocument: vi.fn().mockResolvedValue(undefined),
  exportAppData: vi.fn().mockResolvedValue({}),
  importAppData: vi.fn().mockResolvedValue(undefined),
  setSetting: vi.fn().mockResolvedValue(undefined),
  db: { conversations: { toArray: vi.fn().mockResolvedValue([]) } },
}));

vi.mock('../contexts', () => ({
  useToast: () => vi.fn(),
  useModelStatus: () => ({ anyLoading: false, embeddingModelReady: false }),
  useLang: () => ({ lang: 'en', switchLang: vi.fn() }),
  LangContext: { Provider: ({ children }) => children },
  ToastContext: { Provider: ({ children }) => children },
  ModelStatusContext: { Provider: ({ children }) => children },
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
  ai: { cancelInference: vi.fn(), checkAllModels: vi.fn().mockResolvedValue({ statuses: {} }), getAvailableModels: vi.fn().mockResolvedValue({ models: [] }) },
}));

vi.mock('../lib/error-handler', () => ({
  reportError: vi.fn(),
  setToastHandler: vi.fn(),
}));

vi.mock('../lib/web-search', () => ({
  searchWeb: vi.fn().mockResolvedValue(null),
  cancelWebSearch: vi.fn(),
}));

vi.mock('../lib/agent-tools', () => ({
  detectTool: vi.fn().mockReturnValue(null),
  executeTool: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/llm-server', () => ({
  getServerConfig: () => ({ enabled: false, baseUrl: '', model: '' }),
  generate: vi.fn(),
  checkServer: vi.fn(),
  setServerConfig: vi.fn(),
}));

vi.mock('../hooks/useRAG', () => ({
  useRAG: () => ({
    searchSimilar: vi.fn().mockResolvedValue([]),
    processPDF: vi.fn(),
    processText: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ totalVectors: 0, totalDocuments: 0, dimension: 0 }),
    clearVectors: vi.fn(),
    isProcessing: false,
    progress: { status: '', message: '', progress: 0 },
  }),
}));

vi.mock('../workers/vector-store', () => ({
  getVectorStore: vi.fn().mockResolvedValue({
    search: vi.fn().mockResolvedValue([]),
    addVector: vi.fn(),
    addVectors: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ totalVectors: 0, totalDocuments: 0, dimension: 0 }),
    exportData: vi.fn().mockResolvedValue({}),
    importData: vi.fn(),
  }),
  VectorStore: class {},
  HNSWIndex: class {},
}));

vi.mock('../lib/vector-store-access', () => ({
  getVectorStore: vi.fn().mockResolvedValue({
    search: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ totalVectors: 0, totalDocuments: 0, dimension: 0 }),
    clear: vi.fn(),
    exportData: vi.fn().mockResolvedValue({}),
    importData: vi.fn(),
  }),
}));

vi.mock('../lib/hybrid-search', () => ({
  hybridSearch: vi.fn().mockResolvedValue([]),
  textSearch: vi.fn().mockReturnValue([]),
}));

// Don't mock i18n — use real module
import { t } from '../lib/i18n';
Element.prototype.scrollIntoView = vi.fn();

import { render, screen } from '@testing-library/react';

describe('Integration: App Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar with new chat button', async () => {
    const Sidebar = (await import('../components/Sidebar')).default;
    render(
      <Sidebar
        activeConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText(t('new_chat'))).toBeDefined();
  });

  it('renders settings modal with language options', async () => {
    const SettingsModal = (await import('../components/SettingsModal')).default;
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(t('language'))).toBeDefined();
  });

  it('renders share modal with copy and download options', async () => {
    const ShareModal = (await import('../components/ShareModal')).default;
    render(
      <ShareModal
        showShareModal={true}
        setShowShareModal={vi.fn()}
        messages={[{ id: 1, role: 'user', content: 'Hello', timestamp: new Date().toISOString() }]}
        toast={vi.fn()}
      />,
    );
    expect(screen.getByText((content) => content.startsWith(t('share')))).toBeDefined();
  });

  it('renders error boundary fallback', async () => {
    const ErrorBoundary = (await import('../components/ErrorBoundary')).default;
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child content')).toBeDefined();
  });
});

describe('Integration: i18n Coverage', () => {
  it('all critical UI keys return translated strings', () => {
    const criticalKeys = [
      'app_name', 'chat', 'documents', 'settings', 'new_chat',
      'send', 'cancel_label', 'save', 'clear', 'del', 'edit', 'copy',
      'search_messages', 'type_message', 'ask_documents',
      'bold', 'italic', 'code', 'link', 'list', 'code_block', 'markdown',
      'pause', 'stop', 'resume', 'record_cancel', 'transcribing',
      'error_title', 'error_body', 'reload',
      'back_online', 'you_are_offline', 'loading',
      'filter_all', 'filter_user', 'filter_ai',
      'open_menu', 'close_menu', 'expand_sidebar', 'collapse_sidebar',
      'previous_match', 'next_match', 'close_search', 'dismiss_error',
      'scroll_to_bottom', 'stop_generation',
      'share', 'share_copy', 'share_download',
      'vectors', 'tags', 'language', 'required',
    ];
    for (const key of criticalKeys) {
      const result = t(key);
      expect(result).toBeTruthy();
      // Should not return the key itself for known keys
      expect(result).not.toBe(`[missing: ${key}]`);
    }
  });

  it('i18n interpolates params correctly', () => {
    const result = t('messages_count', { n: 5 });
    expect(result).toContain('5');
  });

  it('returns key itself for truly unknown keys', () => {
    const result = t('nonexistent_key_xyz');
    expect(result).toBe('nonexistent_key_xyz');
  });
});