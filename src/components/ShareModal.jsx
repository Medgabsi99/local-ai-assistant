// ============================================================
// ShareModal — Copy as text or download as Markdown
// ============================================================

import { t } from '../lib/i18n';

export default function ShareModal({ showShareModal, setShowShareModal, messages, toast }) {
  if (!showShareModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in"
      onClick={() => setShowShareModal(false)}
    >
      <div
        className="card w-full max-w-sm p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('share')} ({messages.filter((m) => m.role === 'user' || m.role === 'assistant').length} {t('messages')})
          </p>
          <button
            onClick={() => setShowShareModal(false)}
            className="btn-icon text-slate-400 hover:text-white"
            aria-label={t('close')}
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
            className="flex-1 px-4 py-2 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-[0.97]"
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
            className="flex-1 px-4 py-2 text-xs font-medium rounded-xl transition-all active:scale-[0.97]"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            {t('share_download')}
          </button>
        </div>
      </div>
    </div>
  );
}
