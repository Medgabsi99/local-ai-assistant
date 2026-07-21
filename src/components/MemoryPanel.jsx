// ============================================================
// MemoryPanel — View and manage persistent memory
// Shows all stored memories with the ability to delete individual items
// ============================================================

import { useState, useEffect } from 'react';
import { getMemories, deleteMemory, clearMemories, getMemoryCount } from '../db/memory';
import { t } from '../lib/i18n';
import { useToast } from '../contexts';

/**
 * MemoryPanel — displays stored memories grouped by category.
 * Users can delete individual memories or clear all.
 */
export default function MemoryPanel({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
    toast?.('Memory deleted', 'success');
    loadMemories();
  };

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${count} memories?`)) return;
    await clearMemories();
    toast?.('All memories cleared', 'success');
    loadMemories();
  };

  // Group by category
  const grouped = {};
  for (const m of memories) {
    const cat = m.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  }

  const categoryLabels = {
    identity: '🧑 Identity',
    work: '💼 Work',
    location: '📍 Location',
    preference: '❤️ Preferences',
    trait: '🧬 Traits',
    experience: '🎓 Experience',
    general: '📝 General',
  };

  const categoryOrder = ['identity', 'work', 'location', 'preference', 'trait', 'experience', 'general'];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Memory manager"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            🧠 {t('memory')} ({count})
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading...
          </div>
        ) : count === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              No memories stored yet.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tell the AI things like "I love Python" or "My name is Sarah" — it will remember across conversations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {categoryOrder.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <h3 className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {categoryLabels[cat] || cat} ({items.length})
                  </h3>
                  <div className="space-y-1">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'var(--bg-secondary)' }}
                      >
                        <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                          {m.content}
                        </span>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                          title="Delete this memory"
                          aria-label="Delete memory"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
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
          <button
            onClick={handleClearAll}
            className="w-full mt-5 px-4 py-2 text-xs rounded-lg transition-colors border"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            Clear all {count} memories
          </button>
        )}
      </div>
    </div>
  );
}
