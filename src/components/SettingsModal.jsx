import { useRef, useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';
import { db, exportAppData, importAppData, getConversationMessages, setSetting } from '../db/database';
import { getVectorStore, resetVectorStore } from '../lib/vector-store-access';
import { exportRateLimiter } from '../lib/security';
import { getServerConfig, setServerConfig, checkServer } from '../lib/llm-server';
import { t, getLanguage, getLanguages } from '../lib/i18n';
import { useLang, useToast } from '../contexts';
import { ACCENT_COLORS } from '../lib/constants';
import {
  BarChart3,
  Globe,
  Palette,
  Server,
  Database,
  Download,
  Upload,
  Trash2,
  Brain,
  X,
  HardDrive,
} from 'lucide-react';
import VectorStoreManager from './VectorStoreManager';
import MemoryPanel from './MemoryPanel';

const TABS = [
  { id: 'stats', label: t('statistics'), icon: BarChart3 },
  { id: 'appearance', label: t('appearance'), icon: Palette },
  { id: 'data', label: t('data_management'), icon: Database },
  { id: 'server', label: 'LLM Server', icon: Server },
];

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('stats');
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
      toast?.('Rate limited: too many requests', 'error');
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

  const accentColors = {
    emerald: '#10b981',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    rose: '#f43f5e',
    cyan: '#06b6d4',
  };

  const ActionBtn = ({ icon: Icon, label, onClick, disabled, danger }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 active:scale-[0.98] ${
        danger ? 'text-red-400 hover:bg-red-500/10 border border-red-800/30' : 'hover:bg-white/5'
      }`}
      style={{
        background: danger ? 'rgba(239,68,68,0.05)' : 'var(--bg-secondary)',
        color: danger ? undefined : 'var(--text-primary)',
      }}
    >
      {Icon && (
        <Icon
          size={16}
          className={danger ? 'text-red-400' : ''}
          style={{ color: danger ? undefined : 'var(--text-muted)' }}
        />
      )}
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={t('settings')}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        {/* Sidebar Tabs */}
        <div
          className="w-48 flex-shrink-0 p-3 space-y-1"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('settings')}
            </h2>
            <button onClick={onClose} className="btn-icon text-slate-400 hover:text-white" aria-label={t('close')}>
              <X size={14} />
            </button>
          </div>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === id ? 'ring-1 shadow-sm' : 'hover:bg-white/5'
              }`}
              style={{
                background: activeTab === id ? 'var(--accent-light)' : 'transparent',
                color: activeTab === id ? 'var(--accent)' : 'var(--text-secondary)',
                ringColor: activeTab === id ? 'var(--accent-ring)' : 'transparent',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* === STATS TAB === */}
          {activeTab === 'stats' && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {t('statistics')}
                </h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Your local usage overview
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t('conversations'), value: stats.totalConversations, icon: BarChart3 },
                    { label: t('messages'), value: stats.totalMessages, icon: BarChart3 },
                    { label: t('tokens_est'), value: stats.totalTokens.toLocaleString(), icon: Brain },
                    { label: t('documents'), value: stats.totalDocuments, icon: Database },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-xl p-4 text-center"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <Icon size={18} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                      <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {value}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  <HardDrive size={14} className="inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                  {t('storage')}
                </h3>
                {storageEstimate ? (
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('storage')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(storageEstimate.percentUsed, 100)}%`,
                          background: storageEstimate.percentUsed > 80 ? '#ef4444' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                      {storageEstimate.percentUsed}% used
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                  >
                    {t('storage')}
                  </div>
                )}
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Shortcuts
                </p>
                <div className="space-y-1.5">
                  {[
                    ['⌘N', t('new_chat')],
                    ['⌘1', t('chat')],
                    ['⌘2', t('documents')],
                    ['⌘,', t('settings')],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {desc}
                      </span>
                      <kbd
                        className="text-[11px] px-2 py-0.5 rounded-md font-mono"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* === APPEARANCE TAB === */}
          {activeTab === 'appearance' && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  <Globe size={14} className="inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                  {t('language')}
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Choose your interface language
                </p>
                <div className="flex gap-2">
                  {getLanguages().map((lang) => (
                    <button
                      key={lang}
                      onClick={() => switchLang(lang)}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        getLanguage() === lang ? 'ring-1 shadow-sm' : 'hover:bg-white/5'
                      }`}
                      style={{
                        background: getLanguage() === lang ? 'var(--accent-light)' : 'var(--bg-secondary)',
                        color: getLanguage() === lang ? 'var(--accent)' : 'var(--text-secondary)',
                        ringColor: getLanguage() === lang ? 'var(--accent-ring)' : 'transparent',
                      }}
                    >
                      {lang === 'en' ? '🇬🇧 English' : lang === 'fr' ? '🇫🇷 Français' : '🇸🇦 العربية'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  <Palette size={14} className="inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                  {t('accent_color')}
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Personalize your experience
                </p>
                <div className="flex gap-3">
                  {ACCENT_COLORS.map((name) => (
                    <button
                      key={name}
                      onClick={async () => {
                        document.documentElement.setAttribute('data-accent', name);
                        await setSetting('accent', name);
                      }}
                      className="w-9 h-9 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 ring-2 ring-offset-2 hover:ring-white/30"
                      style={{
                        backgroundColor: accentColors[name],
                        ringColor: 'transparent',
                        '--tw-ring-offset-color': 'var(--bg-primary)',
                      }}
                      title={name}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* === DATA TAB === */}
          {activeTab === 'data' && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  <Database size={14} className="inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                  {t('data_management')}
                </h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Export, import, and manage your local data
                </p>
                <div className="space-y-2">
                  <ActionBtn
                    icon={Download}
                    label={transferring ? t('processing') : t('export_backup')}
                    onClick={handleExportData}
                    disabled={transferring}
                  />
                  <ActionBtn
                    icon={Upload}
                    label={t('import_backup')}
                    onClick={openImportDialog}
                    disabled={transferring}
                  />
                  <ActionBtn icon={Database} label={t('vectors')} onClick={() => setShowVectorManager(true)} />
                  <ActionBtn icon={Brain} label={t('memory')} onClick={() => setShowMemoryPanel(true)} />
                  <ActionBtn
                    icon={Trash2}
                    label={clearing ? t('processing') : t('clear_all')}
                    onClick={handleClearAllData}
                    disabled={clearing}
                    danger
                  />
                </div>
              </div>
            </>
          )}

          {/* === SERVER TAB === */}
          {activeTab === 'server' && (
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                <Server size={14} className="inline mr-1.5" style={{ color: 'var(--text-muted)' }} />
                {t('llm_server')}
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Connect to Ollama, LM Studio, or any OpenAI-compatible API
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                    Server URL
                  </label>
                  <input
                    type="text"
                    value={serverCfg.baseUrl}
                    onChange={(e) => {
                      const n = { ...serverCfg, baseUrl: e.target.value };
                      setServerCfg(n);
                      setServerConfig(n);
                    }}
                    placeholder="http://localhost:11434"
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={serverCfg.model}
                    onChange={(e) => {
                      const n = { ...serverCfg, model: e.target.value };
                      setServerCfg(n);
                      setServerConfig(n);
                    }}
                    placeholder="llama3.2:1b"
                    className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${serverCfg.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {t('server_enabled')}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serverCfg.enabled}
                      onChange={(e) => {
                        const n = { ...serverCfg, enabled: e.target.checked };
                        setServerCfg(n);
                        setServerConfig(n);
                      }}
                      className="sr-only peer"
                    />
                    <div
                      className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                      style={{ background: serverCfg.enabled ? 'var(--accent)' : 'var(--border)' }}
                    />
                  </label>
                </div>
                <button
                  onClick={async () => {
                    setSrvStatus({ checking: true });
                    const r = await checkServer();
                    setSrvStatus({ checking: false, result: r });
                  }}
                  disabled={srvStatus.checking}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  {srvStatus.checking ? 'Testing connection...' : t('test_connection')}
                </button>
                {srvStatus.result && (
                  <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                      srvStatus.result.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${srvStatus.result.available ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                    {srvStatus.result.available ? t('connected') : t('not_connected')}
                  </div>
                )}
              </div>
            </div>
          )}
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
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
