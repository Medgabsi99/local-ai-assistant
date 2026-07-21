import { t } from '../lib/i18n';

export default function ShareModal({ showShareModal, setShowShareModal, messages, toast }) {
  if (!showShareModal) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share conversation"
      style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}
      className="px-4 py-2 border-b flex-shrink-0"
    >
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: 'var(--text-muted)' }} className="text-[10px] font-medium">
          {t('share')} (
          {t('messages_count', { n: messages.filter((m) => m.role === 'user' || m.role === 'assistant').length })})
        </p>
        <button
          onClick={() => setShowShareModal(false)}
          style={{ color: 'var(--text-muted)' }}
          className="text-xs px-2 py-0.5 rounded hover:bg-white/5"
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
          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          className="text-[11px] px-3 py-1.5 rounded-md hover:bg-white/5"
        >
          {t('share_download')}
        </button>
      </div>
    </div>
  );
}
