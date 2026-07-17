import { useRef, useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';
import { db, exportAppData, importAppData, getConversationMessages } from '../db/database';
import { getVectorStore } from '../lib/vector-store-access';
import { getServerConfig, setServerConfig, checkServer } from '../lib/llm-server';
import { t, setLanguage, getLanguage, getLanguages } from '../lib/i18n';
import { useLang, useToast } from '../App';
import { BarChart3, Globe, Palette, Server, Trash2, Lock, Wifi, HardDrive } from 'lucide-react';
import VectorStoreManager from './VectorStoreManager';

export default function SettingsModal({ isOpen, onClose }) {
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [showVectorManager, setShowVectorManager] = useState(false);
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
      } catch {}
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
    } catch {}
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
      await db.delete();
      await db.open();
      const store = await getVectorStore();
      await store.clear();
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) await caches.delete(key);
      await ai.unloadAll();
      toast?.('Data cleared. Reloading...', 'success');
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast?.('Failed: ' + error.message, 'error');
    }
    setClearing(false);
  };

  const handleExportData = async () => {
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
      toast?.('Export failed: ' + error.message, 'error');
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
      toast?.('Invalid JSON file.', 'error');
      return;
    }
    if (!confirm('Replace all data with this backup?')) return;
    setTransferring(true);
    try {
      const store = await getVectorStore();
      await db.delete();
      await db.open();
      await importAppData(payload);
      await store.clear();
      await store.importData(payload.vectorStore || {});
      toast?.('Data imported successfully.', 'success');
      window.location.reload();
    } catch (error) {
      toast?.('Import failed: ' + error.message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{t('settings')}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Stats */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                <BarChart3 size={16} className="inline mr-1" />
                {t('statistics')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t('conversations'), value: stats.totalConversations },
                  { label: t('messages'), value: stats.totalMessages },
                  { label: t('tokens_est'), value: stats.totalTokens.toLocaleString() },
                  { label: t('documents'), value: stats.totalDocuments },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-900 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                <Globe size={16} className="inline mr-1" />
                {t('settings')}
              </h3>
              <div className="flex gap-2">
                {getLanguages().map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      switchLang(lang);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${getLanguage() === lang ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : ''}`}
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
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                <Palette size={16} className="inline mr-1" />
                {t('accent_color')}
              </h3>
              <div className="flex gap-2">
                {[
                  { name: 'emerald', class: 'bg-emerald-500' },
                  { name: 'blue', class: 'bg-blue-500' },
                  { name: 'violet', class: 'bg-violet-500' },
                  { name: 'amber', class: 'bg-amber-500' },
                  { name: 'rose', class: 'bg-rose-500' },
                  { name: 'cyan', class: 'bg-cyan-500' },
                ].map((c) => (
                  <button
                    key={c.name}
                    onClick={async () => {
                      document.documentElement.setAttribute('data-accent', c.name);
                      await setSetting('accent', c.name);
                    }}
                    className={`w-8 h-8 rounded-full ${c.class} transition-all duration-200 hover:scale-110 active:scale-95`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Storage */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">{t('storage')}</h3>
              {storageEstimate ? (
                <div className="bg-slate-900 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-400">{t('storage')}</span>
                    <span className="text-sm text-slate-200">{formatBytes(storageEstimate.usage)}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${storageEstimate.percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{storageEstimate.percentUsed}%</span>
                    <span>{formatBytes(storageEstimate.quota)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t('storage')}</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleExportData}
                disabled={transferring}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors text-left disabled:opacity-50"
              >
                {transferring ? t('processing') : t('export_backup')}
              </button>
              <button
                onClick={openImportDialog}
                disabled={transferring}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors text-left disabled:opacity-50"
              >
                {t('import_backup')}
              </button>
              <button
                onClick={() => setShowVectorManager(true)}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors text-left"
              >
                <Trash2 size={14} className="inline mr-1" />
                {t('settings')}
              </button>
              <button
                onClick={handleClearAllData}
                disabled={clearing}
                className="w-full px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors border border-red-800/50 disabled:opacity-50"
              >
                {clearing ? t('processing') : t('clear_all')}
              </button>

              {/* LLM Server */}
              <div className="border-t border-slate-700 pt-3 mt-3">
                <p className="text-xs font-medium text-slate-400 mb-2">
                  <Server size={14} className="inline mr-1" />
                  {t('llm_server')}
                </p>
                <input
                  type="text"
                  value={serverCfg.baseUrl}
                  onChange={(e) => {
                    const n = { ...serverCfg, baseUrl: e.target.value };
                    setServerCfg(n);
                    setServerConfig(n);
                  }}
                  placeholder="http://localhost:11434"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 mb-2"
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 mb-2"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setSrvStatus({ checking: true });
                      const r = await checkServer();
                      setSrvStatus({ checking: false, result: r });
                    }}
                    disabled={srvStatus.checking}
                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md disabled:opacity-50"
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
                      className="w-4 h-4 rounded border-slate-600"
                    />
                    <span className="text-xs text-slate-400">{t('server_enabled')}</span>
                  </label>
                </div>
                {srvStatus.result && (
                  <div
                    className={`text-xs p-2 mt-2 rounded ${srvStatus.result.available ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}
                  >
                    {srvStatus.result.available ? t('connected') : t('not_connected')}
                  </div>
                )}
              </div>
            </div>

            {/* Keyboard shortcuts */}
            <div className="bg-slate-900 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <p className="text-slate-400 font-medium">{t('settings')}</p>
              <p>⌘1: {t('chat')}</p>
              <p>⌘2: {t('documents')}</p>
              <p>⌘N: {t('new_chat')}</p>
              <p>⌘,: {t('settings')}</p>
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
