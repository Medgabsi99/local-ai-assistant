import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import DocumentPane from './components/DocumentPane';
import SettingsModal from './components/SettingsModal';
import { t } from './lib/i18n';
import { createConversation } from './db/database';

const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
              t.type === 'success' ? 'bg-emerald-500 text-white' :
              t.type === 'error' ? 'bg-red-500 text-white' :
              'bg-slate-800 text-slate-100 border border-slate-700'
            }`}>
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

  useEffect(() => {
    const handleKey = async (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === 'n') { e.preventDefault(); const id = await createConversation(); setActiveConversationId(id); setActiveView('chat'); }
      if (e.key === '1') { e.preventDefault(); setActiveView('chat'); }
      if (e.key === '2') { e.preventDefault(); setActiveView('documents'); }
      if (e.key === ',') { e.preventDefault(); setShowSettings(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleSelectConversation = (id) => { setActiveConversationId(id); setActiveView('chat'); setMobileMenuOpen(false); };
  const handleNewConversation = (id) => { setActiveConversationId(id); setActiveView('chat'); setMobileMenuOpen(false); };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Layout>
          <button className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 shadow-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>

          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
              <div className="absolute left-0 top-0 bottom-0 w-72" onClick={(e) => e.stopPropagation()}>
                <Sidebar activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} onNewConversation={handleNewConversation} onOpenSettings={() => { setShowSettings(true); setMobileMenuOpen(false); }} />
              </div>
            </div>
          )}

          <div className="hidden md:block h-full">
            <Sidebar activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} onNewConversation={handleNewConversation} onOpenSettings={() => setShowSettings(true)} />
          </div>

          <div className="flex-1 flex flex-col min-w-0 h-full">
            <div className="flex items-center border-b border-slate-800 bg-slate-900/50 px-4 flex-shrink-0">
              <button onClick={() => setActiveView('chat')} className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px md:ml-0 ml-10 ${activeView === 'chat' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>💬 {t('chat')}</button>
              <button onClick={() => setActiveView('documents')} className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${activeView === 'documents' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>📄 {t('documents')}</button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeView === 'chat' ? <ChatArea conversationId={activeConversationId} /> : <DocumentPane />}
            </div>
          </div>

          <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </Layout>
      </ToastProvider>
    </ErrorBoundary>
  );
}