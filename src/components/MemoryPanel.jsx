import { useState, useEffect } from 'react';
import { getMemories, deleteMemory, clearMemories } from '../db/memory';
import { t } from '../lib/i18n';
import { useToast } from '../contexts';
import { X, Trash2, Brain } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const CATEGORY_LABELS = {
  identity: { label: () => t('memory_category_identity'), icon: '🧑' },
  work: { label: () => t('memory_category_work'), icon: '💼' },
  location: { label: () => t('memory_category_location'), icon: '📍' },
  preference: { label: () => t('memory_category_preference'), icon: '❤️' },
  trait: { label: () => t('memory_category_trait'), icon: '🧬' },
  experience: { label: () => t('memory_category_experience'), icon: '🎓' },
  general: { label: () => t('memory_category_general'), icon: '📝' },
};

const CATEGORY_ORDER = ['identity', 'work', 'location', 'preference', 'trait', 'experience', 'general'];

export default function MemoryPanel({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const toast = useToast();

  const loadMemories = async () => {
    setLoading(true);
    try {
      const all = await getMemories();
      setMemories(all);
      setCount(all.length);
    } catch (e) {
      console.warn('Failed to load memories:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadMemories();
  }, [isOpen]);

  const handleDelete = async (id) => {
    await deleteMemory(id);
    toast?.(t('memory_deleted'), 'success');
    loadMemories();
  };
  const handleClearAll = () => {
    setShowConfirm(true);
  };

  const doClearAll = async () => {
    await clearMemories();
    toast?.(t('all_memories_cleared'), 'success');
    loadMemories();
  };

  const grouped = {};
  for (const m of memories) {
    const cat = m.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-label={t('memory')} onClick={onClose}>
      <div className="card w-full max-w-md max-h-[80vh] overflow-y-auto p-5 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Brain size={16} style={{ color: 'var(--accent)' }} /> {t('memory')} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({count})</span>
          </h2>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-white" aria-label={t('close')}><X size={14} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : count === 0 ? (
          <div className="text-center py-10">
            <Brain size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{t('no_memories_yet')}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('memory_instructions')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              const meta = CATEGORY_LABELS[cat] || { label: () => cat, icon: '📝' };
              return (
                <div key={cat}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: 'var(--text-muted)' }}>
                    {meta.icon} {meta.label()} ({items.length})
                  </h3>
                  <div className="space-y-1">
                    {items.map((m) => (
                      <div key={m.id} className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs group" style={{ background: 'var(--bg-secondary)' }}>
                        <span className="flex-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{m.content}</span>
                        <button onClick={() => handleDelete(m.id)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100" title={t('delete_memory')} aria-label={t('delete_memory')}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {count > 0 && (
          <button onClick={handleClearAll} className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl transition-all active:scale-[0.98]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Trash2 size={12} /> {t('clear_all_memories', { n: count })}
          </button>
        )}
      </div>
      <ConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={doClearAll} title={t('clear_all_memories', { n: count })} message={t('clear_all_memories', { n: count })} confirmText={t('clear_all_memories', { n: count })} danger />
    </div>
  );
}