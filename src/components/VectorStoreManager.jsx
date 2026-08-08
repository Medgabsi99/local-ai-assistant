import { useState, useEffect, useCallback } from 'react';
import { getAllDocuments } from '../db/database';
import { getVectorStore } from '../lib/vector-store-access';
import { t } from '../lib/i18n';
import { X, Trash2, Database, Brain, HardDrive } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function VectorStoreManager({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const store = await getVectorStore();
      const storeStats = await store.getStats();
      setStats(storeStats);
      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load vector store data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => { void loadData(); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, loadData]);

  const handleClearVectors = async () => {
    setShowConfirm(true);
  };

  const doClearVectors = async () => {
    setClearing(true);
    try {
      const store = await getVectorStore();
      await store.clear();
      await loadData();
    } catch (error) {
      console.error('Failed to clear vectors:', error);
    }
    setClearing(false);
  };

  const estimateStorageSize = () => {
    if (!stats || stats.totalVectors === 0) return `0 ${t('kb')}`;
    const bytesPerVector = stats.dimension * 4;
    const totalBytes = stats.totalVectors * bytesPerVector;
    return formatBytes(totalBytes);
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Database size={16} style={{ color: 'var(--accent)' }} /> {t('vectors')}
          </h2>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-white" aria-label={t('close')}>
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: t('vectors'), value: stats?.totalVectors || 0, icon: '🧬' },
                { label: t('documents'), value: stats?.totalDocuments || 0, icon: '📄' },
                { label: t('dimensions'), value: stats?.dimension || 384, icon: '📐' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-lg">{icon}</span>
                  <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  <HardDrive size={12} className="inline mr-1" />{t('storage')}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{estimateStorageSize()}</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (stats?.totalVectors || 0) / 100)}%`, background: 'var(--accent)' }} />
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>{t('opfs_storage')}</p>
            </div>

            {documents.length > 0 && (
              <div>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('indexed_documents')}</h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{doc.fileType === 'application/pdf' ? '📕' : '📄'}</span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</span>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{(doc.content?.length / 1000).toFixed(1)} {t('kb')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleClearVectors} disabled={clearing || !stats?.totalVectors}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 active:scale-[0.98]"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Trash2 size={12} /> {clearing ? t('clearing') : t('clear_vectors')}
              </button>
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.98]"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {t('close')}
              </button>
            </div>

            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>{t('clear_vectors_desc')}</p>
          </div>
        )}
      </div>
    </div>
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doClearVectors}
        title={t('clear_vectors')}
        message={t('clear_vectors_confirm')}
        confirmText={t('clear_vectors')}
        danger
      />
    </>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}