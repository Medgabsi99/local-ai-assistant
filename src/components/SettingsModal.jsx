import { useRef, useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';
import { db, exportAppData, importAppData, getConversationMessages, setSetting } from '../db/database';
import { getVectorStore, resetVectorStore } from '../lib/vector-store-access';
import { exportRateLimiter } from '../lib/security';
import { getServerConfig, setServerConfig, checkServer } from '../lib/llm-server';
import { t, getLanguage, getLanguages } from '../lib/i18n';
import { useLang, useToast } from '../contexts';
import { ACCENT_COLORS } from '../lib/constants';
import { BarChart3, Globe, Palette, Server } from 'lucide-react';
import VectorStoreManager from './VectorStoreManager';
import MemoryPanel from './MemoryPanel';

export default function SettingsModal({ isOpen, onClose }) {
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [showVectorManager, setShowVectorManager] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const importInputRef = useRef(null);
  const [serverCfg, setServerCfg] = useState(getServerConfig());
  const [srvStatus, setSrvStatus] = useState({ checking: false, result: null });
  const { switchLang } = useLang();
  const toast = useToast();
  const [stats, setStats] = useState({ totalConversations: 0, totalMessages: 0, totalTokens: 0, totalDocuments: 0 });

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const convs = await db.conversations.toArray();
        let msgs = 0,
          tokens = 0;
        for (const c of convs) {
          const m = await getConversationMessages(c.id);
          msgs += m.length;
          tokens += m.reduce((sum, msg) => sum + Math.round(msg.content.length / 4), 0);
        }
        const store = await getVectorStore();
        const s = await store.getStats();
        setStats({
          totalConversations: convs.length,
          totalMessages: msgs,
          totalTokens: tokens,
          totalDocuments: s.totalDocuments || 0,
        });
      } catch (e) {
        console.warn('Stats:', e);
      }
    })();
  }, [isOpen]);

  const estimateStorage = async () => {
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate) {
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentUsed: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0,
        });
      }
    } catch {
      /* storage estimate not available */
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        void estimateStorage();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClearAllData = async () => {
    if (!confirm(t('clear_all_confirm'))) return;
    setClearing(true);
    try {
      const { terminateAll } = await import('../workers/worker-bridge');
      terminateAll();
      resetVectorStore();
      await db.close();
      const knownDatabases = ['LocalAIDB', 'LocalAIVectors', 'LocalAIMemory'];
      for (const name of knownDatabases) indexedDB.deleteDatabase(name);
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) await caches.delete(key);
      await ai.unloadAll();
      toast?.(t('data_cleared'), 'success');
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast?.(t('failed', { message: error.message }), 'error');
      setClearing(false);
    }
  };

  const handleExportData = async () => {
    if (!exportRateLimiter.canCall('export')) {
      toast?.('Rate limited: too many export requests. Please wait.', 'error');
      return;
    }
    setTransferring(true);
    try {
      const store = await getVectorStore();
      const [appData, vectorData] = await Promise.all([exportAppData(), store.exportData()]);
      const payload = { ...appData, vectorStore: vectorData };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `local-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast?.(t('export_failed', { message: error.message }), 'error');
    } finally {
      setTransferring(false);
    }
  };

  const openImportDialog = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast?.(t('invalid_json'), 'error');
      return;
    }
    if (!confirm(t('replace_all_data'))) return;
    setTransferring(true);
    try {
      const store = await getVectorStore();
      await db.delete();
      await db.open();
      await importAppData(payload);
      await store.clear();
      await store.importData(payload.vectorStore || {});
      toast?.(t('data_imported'), 'success');
      window.location.reload();
    } catch (error) {
      toast?.(t('import_failed', { message: error.message }), 'error');
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentStyle = (name) =>
    ({
      emerald: '#10b981',
      blue: '#3b82f6',
      violet: '#8b5cf6',
      amber: '#f59e0b',
      rose: '#f43f5e',
      cyan: '#06b6d4',
    })[name];

  const Btn = ({ onClick, disabled, children, danger }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 text-left disabled:opacity-50 active:scale-[0.98] ${danger ? 'border border-red-800/50 text-red-400 hover:bg-red-600/20' : 'text-slate-200 hover:bg-white/5'}`}
      style={{ background: danger ? 'rgba(239,68,68,0.1)' : 'var(--bg-hover)' }}
    >
      {children}
    </button>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        onClick={onClose}
      >
        <div
          className="card w-full max-w-md max-h-[80vh] overflow-y-auto p-6 shadow-2xl animate-scale-in"
          onClick={(e) => e.stopPropagation()}
          style={{ background: 'var(--bg-card)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('settings')}
            </h2>
            <button onClick={onClose} className="btn-icon text-slate-400 hover:text-white" aria-label={t('close')}>
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Stats */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                <BarChart3 size={14} className="inline mr-1.5" />
                {t('statistics')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t('conversations'), value: stats.totalConversations },
                  { label: t('messages'), value: stats.totalMessages },
                  { label: t('tokens_est'), value: stats.totalTokens.toLocaleString() },
                  { label: t('documents'), value: stats.totalDocuments },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {s.value}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                <Globe size={14} className="inline mr-1.5" />
                {t('language')}
              </h3>
              <div className="flex gap-2">
                {getLanguages().map((lang) => (
                  <button
                    key={lang}
                    onClick={() => switchLang(lang)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${getLanguage() === lang ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : ''}`}
                    style={{
                      background: getLanguage() === lang ? undefined : 'var(--bg-hover)',
                      color: getLanguage() === lang ? undefined : 'var(--text-secondary)',
                    }}
                  >
                    {lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : 'العربية'}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                <Palette size={14} className="inline mr-1.5" />
                {t('accent_color')}
              </h3>
              <div className="flex gap-2">
                {ACCENT_COLORS.map((name) => (
                  <button
                    key={name}
                    onClick={async () => {
                      document.documentElement.setAttribute('data-accent', name);
                      await setSetting('accent', name);
                    }}
                    className="w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ring-2 ring-transparent hover:ring-white/20"
                    style={{ backgroundColor: accentStyle(name) }}
                    title={name}
                  />
                ))}
              </div>
            </div>

            {/* Storage */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('storage')}
              </h3>
              {storageEstimate ? (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {t('storage')}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatBytes(storageEstimate.usage)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full mb-2" style={{ background: 'var(--border)' }}>
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${storageEstimate.percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{storageEstimate.percentUsed}%</span>
                    <span>{formatBytes(storageEstimate.quota)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('storage')}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Btn onClick={handleExportData} disabled={transferring}>
                {transferring ? t('processing') : t('export_backup')}
              </Btn>
              <Btn onClick={openImportDialog} disabled={transferring}>
                {t('import_backup')}
              </Btn>
              <Btn onClick={() => setShowVectorManager(true)}>{t('vectors')}</Btn>
              <Btn onClick={() => setShowMemoryPanel(true)}>🧠 {t('memory')}</Btn>
              <Btn onClick={handleClearAllData} disabled={clearing} danger>
                {clearing ? t('processing') : t('clear_all')}
              </Btn>
            </div>

            {/* LLM Server */}
            <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                <Server size={14} className="inline mr-1.5" />
                {t('llm_server')}
              </h3>
              <input
                type="text"
                value={serverCfg.baseUrl}
                onChange={(e) => {
                  const n = { ...serverCfg, baseUrl: e.target.value };
                  setServerCfg(n);
                  setServerConfig(n);
                }}
                placeholder="http://localhost:11434"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500/50 transition-colors mb-2"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <input
                type="text"
                value={serverCfg.model}
                onChange={(e) => {
                  const n = { ...serverCfg, model: e.target.value };
                  setServerCfg(n);
                  setServerConfig(n);
                }}
                placeholder="llama3.2:1b"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500/50 transition-colors mb-2"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setSrvStatus({ checking: true });
                    const r = await checkServer();
                    setSrvStatus({ checking: false, result: r });
                  }}
                  disabled={srvStatus.checking}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                >
                  {srvStatus.checking ? t('testing') : t('test_connection')}
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serverCfg.enabled}
                    onChange={(e) => {
                      const n = { ...serverCfg, enabled: e.target.checked };
                      setServerCfg(n);
                      setServerConfig(n);
                    }}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('server_enabled')}
                  </span>
                </label>
              </div>
              {srvStatus.result && (
                <div
                  className={`text-xs p-2 mt-2 rounded-lg ${srvStatus.result.available ? 'text-emerald-400' : 'text-red-400'}`}
                  style={{ background: srvStatus.result.available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}
                >
                  {srvStatus.result.available ? t('connected') : t('not_connected')}
                </div>
              )}
            </div>

            {/* Keyboard shortcuts */}
            <div className="rounded-xl p-4 text-xs space-y-1" style={{ background: 'var(--bg-secondary)' }}>
              <p className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('settings')}
              </p>
              {['⌘1: Chat', '⌘2: Documents', '⌘N: New Chat', '⌘,: Settings'].map((s) => (
                <p key={s} style={{ color: 'var(--text-muted)' }}>
                  {s}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      <VectorStoreManager isOpen={showVectorManager} onClose={() => setShowVectorManager(false)} />
      <MemoryPanel isOpen={showMemoryPanel} onClose={() => setShowMemoryPanel(false)} />
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
