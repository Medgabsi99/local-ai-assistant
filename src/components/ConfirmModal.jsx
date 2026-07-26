import { t } from '../lib/i18n';
import { AlertTriangle, X } from 'lucide-react';

/**
 * ConfirmModal — a styled replacement for the native confirm() dialog.
 * Shows a warning icon, message, and Cancel/Confirm buttons.
 */
export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, danger }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: danger ? 'rgba(239,68,68,0.1)' : 'var(--accent-light)' }}
          >
            <AlertTriangle size={20} style={{ color: danger ? '#ef4444' : 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-slate-400 hover:text-white shrink-0"
            aria-label={t('close')}
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98]"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98]"
            style={{
              background: danger ? 'rgba(239,68,68,0.12)' : 'var(--accent-light)',
              color: danger ? '#ef4444' : 'var(--accent)',
              border: danger ? '1px solid rgba(239,68,68,0.2)' : 'none',
            }}
          >
            {confirmText || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
