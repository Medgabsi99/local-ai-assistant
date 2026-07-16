import { t } from '../lib/i18n';
import { Sun, Moon, Search, Globe, Bot, ClipboardList, Share2, RefreshCw } from 'lucide-react';

export default function ChatTopBar({
  useRAGMode,
  setUseRAGMode,
  embeddingModelReady,
  showSystemPrompt,
  setShowSystemPrompt,
  webSearchEnabled,
  setWebSearchEnabled,
  theme,
  toggleTheme,
  agentMode,
  setAgentMode,
  showTemplates,
  setShowTemplates,
  messages,
  showSearch,
  setShowSearch,
  isGenerating,
  onRegenerate,
  showShareModal,
  setShowShareModal,
}) {
  return (
    <div
      className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0 gap-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
    >
      <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
        <input
          type="checkbox"
          checked={useRAGMode}
          onChange={(e) => setUseRAGMode(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
        />
        <span
          className={`text-xs font-medium ${useRAGMode ? 'text-emerald-400' : ''}`}
          style={{ color: useRAGMode ? '#34d399' : 'var(--text-muted)' }}
        >
          {t('rag_mode')}
        </span>
        {useRAGMode && !embeddingModelReady && (
          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            {t('no_embedding')}
          </span>
        )}
      </label>
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
          className={`text-xs px-2 py-1 rounded-md hover:bg-white/5 transition-colors ${webSearchEnabled ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
          style={{ color: webSearchEnabled ? undefined : 'var(--text-muted)' }}
          title={t('web_search')}
          aria-label={t('web_search')}
        >
          <Globe size={14} />
        </button>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="text-xs px-2 py-1 rounded-md hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
          title={t('search')}
          aria-label={t('search')}
        >
          <Search size={14} />
        </button>
        <button
          onClick={toggleTheme}
          className="text-xs px-2 py-1 rounded-md hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={() => setAgentMode(!agentMode)}
          className={`text-xs px-2 py-1 rounded-md hover:bg-white/5 transition-colors ${agentMode ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
          style={{ color: agentMode ? undefined : 'var(--text-muted)' }}
          title={t('agent_mode')}
          aria-label={t('agent_mode')}
        >
          <Bot size={14} />
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-xs px-2 py-1 rounded-md hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
          title={t('prompt_templates')}
          aria-label={t('prompt_templates')}
        >
          <ClipboardList size={14} />
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setShowShareModal(true)}
            className="text-xs px-2 py-1 rounded-md hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('share')}
          >
            <Share2 size={14} />
          </button>
        )}
        {messages.length > 1 && (
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="text-xs disabled:opacity-40 px-2 py-1 rounded-md hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('regenerate')}
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}