import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';

// Lazy-load heavy components not needed on initial render
const DocumentPane = lazy(() => import('./components/DocumentPane'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
import { LangContext, ToastContext, ModelStatusContext } from './contexts.jsx';
import { t, setLanguage, getLanguage } from './lib/i18n';
import { MessageSquare, FileText } from 'lucide-react';
import { ai } from './workers/worker-bridge';
import { setToastHandler } from './lib/error-handler';
import { createConversation } from './db/database';

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);
  // Initialize global error handler with toast
  useEffect(() => {
    setToastHandler(addToast);
  }, [addToast]);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
              t.type === 'success'
                ? 'bg-emerald-500 text-white'
                : t.type === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-800 text-slate-100 border border-slate-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default function App() {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeView, setActiveView] = useState('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState(getLanguage());

  useEffect(() => {
    const handleKey = async (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === 'n') {
        e.preventDefault();
        try {
          const id = await createConversation();
          setActiveConversationId(id);
          setActiveView('chat');
        } catch (e) {
          console.warn('Failed to create conversation:', e);
        }
      }
      if (e.key === '1') {
        e.preventDefault();
        setActiveView('chat');
      }
      if (e.key === '2') {
        e.preventDefault();
        setActiveView('documents');
      }
      if (e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const switchLang = (newLang) => {
    setLanguage(newLang);
    setLang(newLang);
  };

  const [modelStatus, setModelStatus] = useState({ anyLoading: false, embeddingModelReady: false });
  useEffect(() => {
    const check = async () => {
      try {
        const r = await ai.checkAllModels();
        if (r?.statuses) {
          const statuses = r.statuses;
          const anyLoading = Object.values(statuses).some((s) => s.loading);
          setModelStatus({ anyLoading, embeddingModelReady: statuses?.embedding?.loaded || false });
        }
      } catch (e) {
        console.warn('Model status poll:', e);
      }
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);
  const selectConversation = (id) => {
    setActiveConversationId(id);
    setActiveView('chat');
    setMobileMenuOpen(false);
  };
  const handleSelectConversation = selectConversation;
  const handleNewConversation = selectConversation;

  return (
    <ErrorBoundary>
      <LangContext.Provider value={{ lang, switchLang }}>
        <ModelStatusContext.Provider value={modelStatus}>
          <ToastProvider>
            <Layout>
              <button
                className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 shadow-lg"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? t('close_menu') : t('open_menu')}
                aria-expanded={mobileMenuOpen}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
                </svg>
              </button>

              {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
                  <div className="absolute left-0 top-0 bottom-0 w-72" onClick={(e) => e.stopPropagation()}>
                    <Sidebar
                      activeConversationId={activeConversationId}
                      onSelectConversation={handleSelectConversation}
                      onNewConversation={handleNewConversation}
                      onOpenSettings={() => {
                        setShowSettings(true);
                        setMobileMenuOpen(false);
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="hidden md:block h-full">
                <Sidebar
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  onOpenSettings={() => setShowSettings(true)}
                />
              </div>

              <div className="flex-1 flex flex-col min-w-0 h-full">
                <div className="flex items-center border-b border-slate-800 bg-slate-900/50 px-4 flex-shrink-0">
                  <button
                    onClick={() => setActiveView('chat')}
                    role="tab"
                    aria-selected={activeView === 'chat'}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px md:ml-0 ml-10 ${activeView === 'chat' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    <MessageSquare size={14} className="inline mr-1" />
                    {t('chat')}
                  </button>
                  <button
                    onClick={() => setActiveView('documents')}
                    role="tab"
                    aria-selected={activeView === 'documents'}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${activeView === 'documents' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    <FileText size={14} className="inline mr-1" />
                    {t('documents')}
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Suspense
                    fallback={
                      <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                        {t('loading')}
                      </div>
                    }
                  >
                    {activeView === 'chat' ? <ChatArea conversationId={activeConversationId} /> : <DocumentPane />}
                  </Suspense>
                </div>
              </div>

              <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            </Layout>
          </ToastProvider>
        </ModelStatusContext.Provider>
      </LangContext.Provider>
    </ErrorBoundary>
  );
}
