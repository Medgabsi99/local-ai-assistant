import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getConversationMessages, addMessage, deleteMessage, toggleMessageStar } from '../db/database';
import { t } from '../lib/i18n';
import {
  Lock,
  Star,
  Volume2,
  Copy,
  Pencil,
  Trash2,
  Bold,
  Italic,
  Code,
  Link,
  List,
  BookOpen,
  Square,
} from 'lucide-react';
import { useToast, useModelStatus } from '../contexts';
import { SCROLL_THRESHOLD_PX } from '../lib/constants';
import { reportError } from '../lib/error-handler';
import { useChatSend } from '../hooks/useChatSend';
import { useMessageSearch } from '../hooks/useMessageSearch';
import { useSettings } from '../hooks/useSettings';
import ChatTopBar from './ChatTopBar';
import SearchBar from './SearchBar';
import SystemPromptEditor from './SystemPromptEditor';
import TemplatesPanel from './TemplatesPanel';
import ShareModal from './ShareModal';
import AudioRecorder from './AudioRecorder';
import { useSmartReplies } from '../hooks/useSmartReplies';
import { useImageAttachments } from '../hooks/useImageAttachments';
import MarkdownImage from './MarkdownImage';

// Highlight matching text in search results
function HighlightedText({ text, searchQuery }) {
  if (!searchQuery.trim()) return <>{text}</>;
  const q = searchQuery.toLowerCase();
  const lower = text.toLowerCase();
  const parts = [];
  let lastIndex = 0;
  let idx = lower.indexOf(q, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) parts.push({ match: false, text: text.slice(lastIndex, idx) });
    parts.push({ match: true, text: text.slice(idx, idx + q.length) });
    lastIndex = idx + q.length;
    idx = lower.indexOf(q, lastIndex);
  }
  if (lastIndex < text.length) parts.push({ match: false, text: text.slice(lastIndex) });
  return (
    <span>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');
  if (!lang) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]">{code}</code>;
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 text-[11px] text-slate-500">
        <span>{lang}</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="hover:text-slate-300 transition-colors"
          aria-label={t('copy')}
        >
          <Copy size={12} />
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function ChatArea({ conversationId }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [useRAGMode, setUseRAGMode] = useState(true);
  const [, setRetrievedContext] = useState(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const { embeddingModelReady } = useModelStatus();
  const { theme, toggleTheme, systemPrompt, saveSystemPrompt } = useSettings();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);
  // Guard refs to prevent race conditions on async operations
  const processingRef = useRef(false);
  const saveEditIdRef = useRef(0);

  const loadMessages = useCallback(async () => {
    if (conversationId) {
      setMessages(await getConversationMessages(conversationId));
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const { isGenerating, streamingContent, handleSend, generateReply, stopGeneration } = useChatSend({
    conversationId,
    messages,
    useRAGMode,
    webSearchEnabled,
    agentMode,
    systemPrompt,
    setRetrievedContext,
    loadMessages,
    toast,
  });

  const { suggestions } = useSmartReplies(messages);
  const { pendingImages, addImage, removeImage, clearImages, handleFileDrop, handlePaste, buildMessageContent } =
    useImageAttachments();

  const [showSearch, setShowSearch] = useState(false);
  const {
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
    searchInputRef,
  } = useMessageSearch(messages, showSearch, setShowSearch);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadMessages().catch(() => {});
  }, [loadMessages]);
  useEffect(() => {
    if (!userScrolledUp) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, userScrolledUp]);
  useEffect(() => {
    if (!isGenerating) inputRef.current?.focus();
  }, [isGenerating]);

  const handleTranscription = (text) => setInput((prev) => prev + (prev ? ' ' : '') + text);

  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX;
    setUserScrolledUp(!isAtBottom);
    setShowScrollBtn(!isAtBottom && messages.length > 0);
  }, [messages.length]);

  const copyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast?.(t('copy'), 'success');
    } catch (e) {
      reportError(e, 'clipboard copy');
    }
  };
  const startEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };
  const saveEdit = async (msgId) => {
    if (!editContent.trim() || processingRef.current) return;
    const saveId = ++saveEditIdRef.current;
    processingRef.current = true;
    const content = editContent.trim();
    try {
      await deleteMessage(msgId);
      await addMessage(conversationId, 'user', content);
      setEditingMessageId(null);
      setEditContent('');
      await loadMessages();
      // Only generate reply if this is still the latest saveEdit call
      if (saveId === saveEditIdRef.current) {
        await generateReply(content);
      }
    } finally {
      if (saveId === saveEditIdRef.current) {
        processingRef.current = false;
      }
    }
  };
  const deleteMsg = async (msgId) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await deleteMessage(msgId);
      await loadMessages();
      toast?.(t('del'), 'success');
    } finally {
      processingRef.current = false;
    }
  };
  const toggleStar = async (msgId) => {
    await toggleMessageStar(msgId);
    await loadMessages();
  };
  const regenerate = async () => {
    if (messages.length < 2 || processingRef.current) return;
    processingRef.current = true;
    try {
      const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastAi || !lastUser) return;
      await deleteMessage(lastAi.id);
      await loadMessages();
      generateReply(lastUser.content);
    } finally {
      processingRef.current = false;
    }
  };

  const insertMarkdown = (before, after = '') => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = input.substring(start, end);
    setInput(input.substring(0, start) + before + selected + after + input.substring(end));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleSendMessage = () => {
    if ((!input.trim() && pendingImages.length === 0) || isGenerating) return;
    const content = buildMessageContent(input.trim());
    clearImages();
    setInput('');
    handleSend(content);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center p-8 overflow-y-auto">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Lock size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('app_name')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm mb-8 leading-relaxed">
            {t('all_data_device')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ChatTopBar
        useRAGMode={useRAGMode}
        setUseRAGMode={setUseRAGMode}
        embeddingModelReady={embeddingModelReady}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        theme={theme}
        toggleTheme={toggleTheme}
        agentMode={agentMode}
        setAgentMode={setAgentMode}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        messages={messages}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        isGenerating={isGenerating}
        onRegenerate={regenerate}
        setShowShareModal={setShowShareModal}
      />

      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchIndex={searchIndex}
        setSearchIndex={setSearchIndex}
        filterRole={filterRole}
        setFilterRole={setFilterRole}
        searchResults={searchResults}
        totalMatchCount={totalMatchCount}
        searchInputRef={searchInputRef}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
      />
      <SystemPromptEditor
        systemPrompt={systemPrompt}
        saveSystemPrompt={saveSystemPrompt}
        showSystemPrompt={showSystemPrompt}
        setShowSystemPrompt={setShowSystemPrompt}
      />
      <TemplatesPanel
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        setInput={setInput}
        inputRef={inputRef}
      />

      <ShareModal
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        messages={messages}
        toast={toast}
      />

      <div
        ref={messagesRef}
        onScroll={handleScroll}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const dropped = await handleFileDrop(e);
          if (dropped) toast?.('📷 Image(s) dropped', 'success');
        }}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {messages.length === 0 && !isGenerating && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('no_messages')}
            </p>
          </div>
        )}
        {(searchQuery.trim() || filterRole !== 'all' ? filteredMessages : messages).map((msg) => (
          <div
            key={msg.id}
            id={`msg-${msg.id}`}
            className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in ${activeSearchId === msg.id ? 'ring-2 ring-emerald-500/40 ring-offset-2 rounded-xl' : ''}`}
            style={{ ringOffsetColor: 'var(--bg-primary)' }}
          >
            <div className="max-w-[80%]">
              {editingMessageId === msg.id ? (
                <div
                  className="border border-emerald-500/30 rounded-xl p-3"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none resize-none mb-2"
                    rows={3}
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-2 py-1 rounded hover:bg-white/5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('cancel_label')}
                    </button>
                    <button
                      onClick={() => saveEdit(msg.id)}
                      className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1 rounded-md"
                    >
                      {t('save_send')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}>
                  {/* Plain text search matches highlighted */}
                  {searchQuery.trim() && getHighlights(msg.content).length > 0 ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none">
                      <HighlightedText text={msg.content} searchQuery={searchQuery} />
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          img({ src, alt }) {
                            return <MarkdownImage src={src} alt={alt} />;
                          },
                          code({ inline, className, children, ...props }) {
                            if (inline)
                              return (
                                <code
                                  className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            return <CodeBlock className={className}>{children}</CodeBlock>;
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.metadata?.contextSources?.length > 0 && (
                    <p className="mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400">
                      {t('sources')} {msg.metadata.contextSources.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {editingMessageId !== msg.id && (
                <div
                  className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <button
                    onClick={() => toggleStar(msg.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                    style={{ color: msg.metadata?.starred ? '#f59e0b' : 'var(--text-muted)' }}
                    title={msg.metadata?.starred ? t('unstar') : t('star')}
                  >
                    <Star size={12} fill={msg.metadata?.starred ? '#f59e0b' : 'none'} />
                  </button>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        if (speaking) {
                          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                          setSpeaking(false);
                          return;
                        }
                        if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance(msg.content.replace(/<[^>]*>/g, ''));
                          u.onend = () => setSpeaking(false);
                          const voices = window.speechSynthesis.getVoices();
                          const v =
                            voices.find(
                              (x) =>
                                x.name.includes('Google UK Female') ||
                                x.name.includes('Microsoft Zira') ||
                                x.name.includes('Samantha'),
                            ) ||
                            voices.find((x) => x.lang.startsWith('en') && x.name.includes('Female')) ||
                            voices.find((x) => x.lang.startsWith('en'));
                          if (v) u.voice = v;
                          u.rate = 1.05;
                          u.pitch = 1.05;
                          setSpeaking(true);
                          window.speechSynthesis.speak(u);
                        }
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                      style={{ color: speaking ? '#ef4444' : 'var(--text-muted)' }}
                      title={speaking ? t('stop') : t('read_aloud')}
                    >
                      {speaking ? <Square size={12} /> : <Volume2 size={12} />}
                    </button>
                  )}
                  <button
                    onClick={() => copyMessage(msg.content)}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                    title={t('copy')}
                  >
                    <Copy size={12} />
                  </button>
                  {msg.role === 'user' && (
                    <button
                      onClick={() => startEdit(msg)}
                      className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                      style={{ color: 'var(--text-muted)' }}
                      title={t('edit')}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMsg(msg.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                    title={t('del')}
                  >
                    <Trash2 size={12} />
                  </button>
                  <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>
                    {msg.metadata?.timeMs ? `${(msg.metadata.timeMs / 1000).toFixed(1)}s · ` : ''}
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.metadata?.starred && ' ⭐'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[80%]">
              <div className="msg-ai">
                {streamingContent ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ inline, className, children, ...props }) {
                          if (inline)
                            return (
                              <code
                                className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          return <CodeBlock className={className}>{children}</CodeBlock>;
                        },
                      }}
                    >
                      {streamingContent}
                    </ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                  </div>
                ) : (
                  <div className="flex gap-1.5 py-2">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Smart reply suggestions */}
        {suggestions.length > 0 && !isGenerating && (
          <div className="px-4 py-2 flex gap-2 flex-wrap">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending image previews */}
      {pendingImages.length > 0 && (
        <div className="px-4 pt-2 flex gap-2 overflow-x-auto" style={{ background: 'var(--bg-primary)' }}>
          {pendingImages.map((img) => (
            <div key={img.id} className="relative group shrink-0">
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-14 h-14 rounded-lg object-cover border border-slate-600"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              {img.caption && (
                <p className="text-[9px] mt-0.5 max-w-14 truncate" style={{ color: 'var(--text-muted)' }}>
                  {img.caption.slice(0, 20)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <div
        className={`px-4 py-3 border-t flex-shrink-0 ${pendingImages.length > 0 ? 'border-t-0' : ''}`}
        style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-0.5 mb-2 flex-wrap">
          <button
            onClick={() => insertMarkdown('**', '**')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('bold')}
            aria-label={t('bold')}
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('*', '*')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('italic')}
            aria-label={t('italic')}
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('`', '`')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('code')}
            aria-label={t('code')}
          >
            <Code size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('[', '](url)')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('link')}
            aria-label={t('link')}
          >
            <Link size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('- ')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('list')}
            aria-label={t('list')}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('```\n', '\n```')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('code_block')}
            aria-label={t('code_block')}
          >
            <BookOpen size={14} />
          </button>
          <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
            {t('markdown')}
          </span>
        </div>
        <div className="flex gap-2 max-w-4xl mx-auto">
          <AudioRecorder onTranscriptionComplete={handleTranscription} />

          {/* Image attachment button */}
          <input
            type="file"
            accept="image/*"
            id="image-upload"
            className="hidden"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              for (const file of files) {
                await addImage(file);
              }
              if (files.length > 0) {
                toast?.(`📷 ${files.length} image(s) attached`, 'success');
              }
            }}
          />
          <label
            htmlFor="image-upload"
            className="inline-flex items-center justify-center rounded-xl text-sm transition-all h-[42px] w-[42px] p-0 hover:bg-white/5 cursor-pointer relative"
            style={{ color: 'var(--text-muted)' }}
            title="Attach image"
            aria-label="Attach image"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {pendingImages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">
                {pendingImages.length}
              </span>
            )}
          </label>
          <div className="flex-1 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={async (e) => {
                const hasImage = Array.from(e.clipboardData.items).some((i) => i.type.startsWith('image/'));
                if (hasImage) {
                  e.preventDefault();
                  await handlePaste(e);
                  toast?.('📷 Image pasted', 'success');
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={useRAGMode ? t('ask_documents') : t('type_message')}
              rows={1}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 min-h-[42px] max-h-32 resize-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              disabled={isGenerating}
            />
            {isGenerating ? (
              <button
                onClick={stopGeneration}
                className="inline-flex items-center justify-center rounded-xl font-medium text-sm transition-all h-[42px] w-[42px] p-0 bg-red-500 hover:bg-red-400 text-white"
                aria-label={t('stop_generation')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={!input.trim()}
                className="inline-flex items-center justify-center rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none h-[42px] w-[42px] p-0 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg"
                aria-label={t('send')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {showScrollBtn && (
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setShowScrollBtn(false);
            }}
            className="fixed bottom-20 right-8 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-all animate-fade-in"
            aria-label={t('scroll_to_bottom')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
