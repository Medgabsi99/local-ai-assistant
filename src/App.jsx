import { useState } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import DocumentPane from './components/DocumentPane';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeView, setActiveView] = useState('chat');
  const [showSettings, setShowSettings] = useState(false);

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setActiveView('chat');
  };

  const handleNewConversation = (id) => {
    setActiveConversationId(id);
    setActiveView('chat');
  };

  return (
    <Layout>
      <Sidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setActiveView('chat')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'chat'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setActiveView('documents')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'documents'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Documents
          </button>
        </div>

        {/* View Content */}
        {activeView === 'chat' ? (
          <ChatArea conversationId={activeConversationId} />
        ) : (
          <DocumentPane />
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </Layout>
  );
}
