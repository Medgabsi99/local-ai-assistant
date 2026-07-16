import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  getConversationMessages,
  addMessage,
  deleteMessage,
  updateConversationTitle,
  getSetting,
  setSetting,
  toggleMessageStar,
} from '../db/database';
import { ai } from '../workers/worker-bridge';
import { t } from '../lib/i18n';
import { Lock, Star, Volume2, Copy, Pencil, Trash2, Bold, Italic, Code, Link, List, BookOpen } from 'lucide-react';
import { useToast } from '../App';
import { useChatSend } from '../hooks/useChatSend';
import { useMessageSearch } from '../hooks/useMessageSearch';
import ChatTopBar from './ChatTopBar';
import AudioRecorder from './AudioRecorder';
import { MessageSkeleton } from './Skeleton';

function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');
  if (!lang) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]">{code}</code>;
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60">
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 text-[11px] text-slate-500">
        <span>{lang}</span>
        <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-slate-300 transition-colors">
          📋
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
  const [retrievedContext, setRetrievedContext] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [embeddingModelReady, setEmbeddingModelReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (conversationId) {
      setMessages(await getConversationMessages(conversationId));
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const { isGenerating, streamingContent, setStreamingContent, handleSend, generateReply, stopGeneration } =
    useChatSend({
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

  const [showSearch, setShowSearch] = useState(false);
  const {
    searchQuery, setSearchQuery, searchIndex, setSearchIndex,
    filterRole, setFilterRole, filteredMessages, searchResults, activeSearchId,
    totalMatchCount, getSnippet, searchInputRef,
  } = useMessageSearch(messages, showSearch, setShowSearch);

  useEffect(() => {
    (async () => {
      const [themeS, promptS, accentS] = await Promise.all([
        getSetting('theme'),
        getSetting('systemPrompt'),
        getSetting('accent'),
      ]);
      if (themeS?.value) setTheme(themeS.value);
      if (promptS?.value) setSystemPrompt(promptS.value);
      if (accentS?.value) document.documentElement.setAttribute('data-accent', accentS.value);
    })();
  }, []);

  useEffect(() => {
    let c = false;
    const check = async () => {
      try {
        const r = await ai.checkAllModels();
        if (!c) {
          const anyLoaded = Object.values(r.statuses || {}).some((s) => s.loaded || s.loading);
          setModelsLoading(!anyLoaded);
          setEmbeddingModelReady(r.statuses?.embedding?.loaded || false);
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 3000);
    return () => {
      c = true;
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);
  useEffect(() => {
    if (!userScrolledUp) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, userScrolledUp]);
  useEffect(() => {
    if (!isGenerating) inputRef.current?.focus();
  }, [isGenerating]);

  const toggleTheme = async () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n);
    await setSetting('theme', n);
  };
  const handleTranscription = (t) => setInput((p) => p + (p ? ' ' : '') + t);
  const saveSystemPrompt = async (v) => {
    setSystemPrompt(v);
    await setSetting('systemPrompt', v);
  };

  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setUserScrolledUp(!isAtBottom);
    setShowScrollBtn(!isAtBottom && messages.length > 0);
  }, [messages.length]);

  const copyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast?.(t('copy'), 'success');
    } catch {}
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
    if (!editContent.trim()) return;
    const content = editContent.trim();
    await deleteMessage(msgId);
    await addMessage(conversationId, 'user', content);
    setEditingMessageId(null);
    setEditContent('');
    await loadMessages();
    await generateReply(content);
  };
  const deleteMsg = async (msgId) => {
    await deleteMessage(msgId);
    await loadMessages();
    toast?.(t('del'), 'success');
  };
  const toggleStar = async (msgId) => {
    await toggleMessageStar(msgId);
    await loadMessages();
  };
  const regenerate = async () => {
    if (messages.length < 2) return;
    const lastAi = [...messages].reverse().find((m) => m.role === 'assistant');
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastAi || !lastUser) return;
    await deleteMessage(lastAi.id);
    await loadMessages();
    generateReply(lastUser.content);
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

  const onSend = () => {
    if (!input.trim() || isGenerating) return;
    const msg = input.trim();
    setInput('');
    handleSend(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
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
        showSystemPrompt={showSystemPrompt}
        setShowSystemPrompt={setShowSystemPrompt}
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
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
      />

      {showSearch && (
        <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); }}
              placeholder={t('search_messages')}
              className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {searchQuery.trim() && (
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {searchResults.length > 0
                  ? `${searchIndex + 1}/${searchResults.length} msgs · ${totalMatchCount} matches`
                  : '0 matches'}
              </span>
            )}
            <div className="flex gap-0.5">
              {['all', 'user', 'assistant'].map((role) => (
                <button
                  key={role}
                  onClick={() => { setFilterRole(role); setSearchIndex(0); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    filterRole === role ? 'bg-emerald-500/20 text-emerald-300' : ''
                  }`}
                  style={{
                    background: filterRole === role ? undefined : 'var(--bg-hover)',
                    color: filterRole === role ? undefined : 'var(--text-muted)',
                  }}
                >
                  {role === 'all' ? 'All' : role === 'user' ? 'User' : 'AI'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSearchIndex((i) => Math.max(0, i - 1))}
              disabled={searchResults.length === 0}
              className="text-xs disabled:opacity-30 px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              ▲
            </button>
            <button
              onClick={() => setSearchIndex((i) => Math.min(searchResults.length - 1, i + 1))}
              disabled={searchResults.length === 0}
              className="text-xs disabled:opacity-30 px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              ▼
            </button>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="text-xs px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showSystemPrompt && (
        <div
          className="px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}
        >
          <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('system_prompt_short')}
          </p>
          <div className="flex gap-2 mb-2">
            <textarea
              value={systemPrompt}
              onChange={(e) => saveSystemPrompt(e.target.value)}
              placeholder={t('type_placeholder')}
              rows={2}
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50 resize-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={() => {
                saveSystemPrompt('');
                setShowSystemPrompt(false);
              }}
              className="text-xs px-2 py-1 rounded-md hover:bg-white/5 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('clear')}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: t('presets_concise'), value: t('concise') },
              { label: t('presets_expert'), value: t('expert') },
              { label: t('presets_translate'), value: t('translate_fr') },
              { label: t('presets_step'), value: t('step_by_step') },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => saveSystemPrompt(preset.value)}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${systemPrompt === preset.value ? 'bg-emerald-500/20 text-emerald-300' : ''}`}
                style={{
                  background: systemPrompt === preset.value ? undefined : 'var(--bg-hover)',
                  color: systemPrompt === preset.value ? undefined : 'var(--text-muted)',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showTemplates && (
        <div
          className="px-4 py-2 border-b flex-shrink-0"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)',
          }}
        >
          <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('prompt_templates')}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[
              {
                label: t('presets_concise'),
                prompt: t('concise'),
              },
              {
                label: t('presets_expert'),
                prompt: t('expert'),
              },
              {
                label: t('presets_translate'),
                prompt: t('translate_fr'),
              },
              {
                label: t('presets_step'),
                prompt: t('step_by_step'),
              },
            ].map((tmpl) => (
              <button
                key={tmpl.label}
                onClick={() => {
                  setInput(tmpl.prompt);
                  setShowTemplates(false);
                  inputRef.current?.focus();
                }}
                className="text-[10px] px-2.5 py-1.5 rounded-md transition-colors hover:bg-white/5"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                {tmpl.label}
              </button>
            ))}
            <button
              onClick={() => setShowTemplates(false)}
              className="text-[10px] px-2 py-1 rounded-md hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showShareModal && (
        <div
          className="px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('share')} (
              {t('messages_count', { n: messages.filter((m) => m.role === 'user' || m.role === 'assistant').length })})
            </p>
            <button
              onClick={() => setShowShareModal(false)}
              className="text-xs px-2 py-0.5 rounded hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(
                  messages.map((m) => `${m.role === 'user' ? 'User' : 'AI'}:\n${m.content}`).join('\n\n'),
                );
                setShowShareModal(false);
                toast?.(t('share_copy'), 'success');
              }}
              className="text-[11px] px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              {t('share_copy')}
            </button>
            <button
              onClick={async () => {
                const md = messages
                  .map((m) => `### ${m.role === 'user' ? 'User' : 'AI'}\n${m.content}`)
                  .join('\n\n---\n\n');
                const b = new Blob([md], { type: 'text/markdown' });
                const u = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = u;
                a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
                a.click();
                URL.revokeObjectURL(u);
                setShowShareModal(false);
              }}
              className="text-[11px] px-3 py-1.5 rounded-md hover:bg-white/5"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              {t('share_download')}
            </button>
          </div>
        </div>
      )}

      <div ref={messagesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
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
                    <button onClick={cancelEdit} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>{t('cancel_label')}</button>
                    <button onClick={() => saveEdit(msg.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1 rounded-md">{t('save_send')}</button>
                  </div>
                </div>
              ) : (
                <div className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}>
                  <div className="prose prose-invert prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code({ node, inline, className, children, ...props }) { if (inline) return <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]" {...props}>{children}</code>; return <CodeBlock className={className}>{children}</CodeBlock>; } }}>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.metadata?.contextSources?.length > 0 && <p className="mt-2 pt-2 border-t border-slate-600/30 text-xs text-slate-400">{t('sources')} {msg.metadata.contextSources.join(', ')}</p>}
                </div>
              )}
              {editingMessageId !== msg.id && (
                <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <button onClick={() => toggleStar(msg.id)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: msg.metadata?.starred ? '#f59e0b' : 'var(--text-muted)' }} title={msg.metadata?.starred ? t('unstar') : t('star')}>
                    <Star size={12} fill={msg.metadata?.starred ? '#f59e0b' : 'none'} />
                  </button>
                  {msg.role === 'assistant' && (
                    <button onClick={() => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(msg.content.replace(/<[^>]*>/g, '')); const voices = window.speechSynthesis.getVoices(); const v = voices.find(x => x.name.includes('Google UK Female') || x.name.includes('Microsoft Zira') || x.name.includes('Samantha')) || voices.find(x => x.lang.startsWith('en') && x.name.includes('Female')) || voices.find(x => x.lang.startsWith('en')); if (v) u.voice = v; u.rate = 1.05; u.pitch = 1.05; window.speechSynthesis.speak(u); } }} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title={t('read_aloud')}>
                      <Volume2 size={12} />
                    </button>
                  )}
                  <button onClick={() => copyMessage(msg.content)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title={t('copy')}>
                    <Copy size={12} />
                  </button>
                  {msg.role === 'user' && <button onClick={() => startEdit(msg)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title={t('edit')}>
                    <Pencil size={12} />
                  </button>}
                  <button onClick={() => deleteMsg(msg.id)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title={t('del')}>
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
                        code({ node, inline, className, children, ...props }) {
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
        <div ref={messagesEndRef} />
      </div>

      <div
        className="px-4 py-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
      >
        <div className="flex items-center gap-0.5 mb-2 flex-wrap">
          <button
            onClick={() => insertMarkdown('**', '**')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('bold')}
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('*', '*')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('italic')}
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('`', '`')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('code')}
          >
            <Code size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('[', '](url)')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('link')}
          >
            <Link size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('- ')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('list')}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => insertMarkdown('```\n', '\n```')}
            className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            title={t('code_block')}
          >
            <BookOpen size={14} />
          </button>
          <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
            {t('markdown')}
          </span>
        </div>
        <div className="flex gap-2 max-w-4xl mx-auto">
          <AudioRecorder onTranscriptionComplete={handleTranscription} />
          <div className="flex-1 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim()}
                className="inline-flex items-center justify-center rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none h-[42px] w-[42px] p-0 bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg"
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
