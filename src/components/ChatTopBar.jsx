import { t } from '../lib/i18n';
import { Sun, Moon, Search, Globe, Bot, ClipboardList, Share2, RefreshCw, Lightbulb } from 'lucide-react';

export default function ChatTopBar({
  useRAGMode,
  setUseRAGMode,
  embeddingModelReady,
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
  setShowShareModal,
  smartRepliesEnabled,
  setSmartRepliesEnabled,
}) {
  const ToggleBtn = ({ active, onClick, icon: Icon, label, title }) => (
    <button
      onClick={onClick}
      className={`btn-icon transition-all duration-200 ${active ? 'bg-accent/20 text-accent ring-1 ring-accent/30' : ''}`}
      style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
      title={title || label}
      aria-label={label}
    >
      <Icon size={14} />
    </button>
  );

  return (
    <div
      className="px-3 py-1.5 border-b flex items-center justify-between flex-shrink-0 gap-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
    >
      {/* RAG Toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 group">
        <div className="relative">
          <input
            type="checkbox"
            checked={useRAGMode}
            onChange={(e) => setUseRAGMode(e.target.checked)}
            className="sr-only peer"
          />
          <div
            className="w-8 h-4 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"
            style={{ background: useRAGMode ? 'var(--accent)' : 'var(--border)' }}
          />
        </div>
        <span
          className={`text-xs font-medium transition-colors ${useRAGMode ? 'text-accent' : ''}`}
          style={{ color: useRAGMode ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {t('rag_mode')}
        </span>
        {useRAGMode && !embeddingModelReady && (
          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            {t('no_embedding')}
          </span>
        )}
      </label>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5">
        <ToggleBtn
          active={webSearchEnabled}
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
          icon={Globe}
          label={t('web_search')}
        />
        <ToggleBtn onClick={() => setShowSearch(!showSearch)} icon={Search} label={t('search')} />
        <ToggleBtn onClick={toggleTheme} icon={theme === 'dark' ? Sun : Moon} label="Toggle theme" />
        <ToggleBtn active={agentMode} onClick={() => setAgentMode(!agentMode)} icon={Bot} label={t('agent_mode')} />
        <ToggleBtn
          onClick={() => setShowTemplates(!showTemplates)}
          icon={ClipboardList}
          label={t('prompt_templates')}
        />
        {messages.length > 0 && <ToggleBtn onClick={() => setShowShareModal(true)} icon={Share2} label={t('share')} />}
        <ToggleBtn
          active={smartRepliesEnabled}
          onClick={() => setSmartRepliesEnabled(!smartRepliesEnabled)}
          icon={Lightbulb}
          label="Smart replies"
          title="Smart replies (doubles inference per turn)"
        />
        {messages.length > 1 && (
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="btn-icon disabled:opacity-30 transition-all"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('regenerate')}
          >
            <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
