// ============================================================
// MessageBubble — renders a single chat message with actions
// Extracted from ChatArea.jsx to reduce file size
// ============================================================

import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Pencil, Trash2, Star, Volume2, Square } from 'lucide-react';
import { t } from '../lib/i18n';
import MarkdownImage from './MarkdownImage';

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
          aria-label={t('code_block_copy')}
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

const MessageBubble = memo(function MessageBubble({
  msg,
  searchQuery,
  activeSearchId,
  editingMessageId,
  editContent,
  setEditContent,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onToggleStar,
  onCopy,
  onRegenerate,
  speaking,
  setSpeaking,
}) {
  const isEditing = editingMessageId === msg.id;

  return (
    <div
      id={`msg-${msg.id}`}
      className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up ${activeSearchId === msg.id ? 'ring-2 ring-emerald-500/40 ring-offset-2 rounded-xl' : ''}`}
      style={{ ringOffsetColor: 'var(--bg-primary)' }}
    >
      <div className="max-w-[80%]">
        {isEditing ? (
          <div className="border border-emerald-500/30 rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-transparent text-sm outline-none resize-none mb-2"
              rows={3}
              style={{ color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancelEdit}
                className="text-xs px-2 py-1 rounded hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('cancel_label')}
              >
                {t('cancel_label')}
              </button>
              <button
                onClick={() => onSaveEdit(msg.id)}
                className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1 rounded-md"
                aria-label={t('save_send')}
              >
                {t('save_send')}
              </button>
            </div>
          </div>
        ) : (
          <div className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}>
            {searchQuery.trim() && msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ? (
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
                          <code className="bg-slate-700/60 px-1 py-0.5 rounded text-emerald-300 text-[13px]" {...props}>
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
        {!isEditing && (
          <div
            className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <button
              onClick={() => onToggleStar(msg.id)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
              style={{ color: msg.metadata?.starred ? '#f59e0b' : 'var(--text-muted)' }}
              title={msg.metadata?.starred ? t('unstar') : t('star')}
              aria-label={msg.metadata?.starred ? t('unstar') : t('star')}
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
                aria-label={speaking ? t('stop') : t('read_aloud')}
              >
                {speaking ? <Square size={12} /> : <Volume2 size={12} />}
              </button>
            )}
            <button
              onClick={() => onCopy(msg.content)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              title={t('copy')}
              aria-label={t('copy')}
            >
              <Copy size={12} />
            </button>
            {msg.role === 'user' && (
              <button
                onClick={() => onStartEdit(msg)}
                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
                style={{ color: 'var(--text-muted)' }}
                title={t('edit')}
                aria-label={t('edit')}
              >
                <Pencil size={12} />
              </button>
            )}
            <button
              onClick={() => onDelete(msg.id)}
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              title={t('del')}
              aria-label={t('del')}
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
  );
});

export default MessageBubble;