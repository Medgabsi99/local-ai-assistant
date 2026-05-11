import { useState, useEffect } from 'react';
import {
  getAllConversations,
  createConversation,
  deleteConversation,
} from '../db/database';
import ModelStatus from './ModelStatus';

export default function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}) {
  const [conversations, setConversations] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  const loadConversations = async () => {
    const convs = await getAllConversations();
    setConversations(convs);
  };

  useEffect(() => {
    loadConversations();
  }, [activeConversationId]);

  const handleNewChat = async () => {
    const id = await createConversation();
    await loadConversations();
    onNewConversation(id);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteConversation(id);
    await loadConversations();
    if (activeConversationId === id) {
      onNewConversation(null);
    }
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          title="Expand sidebar"
        >
          <ChevronRightIcon />
        </button>
        <button
          onClick={handleNewChat}
          className="mt-4 p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors"
          title="New chat"
        >
          <PlusIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🔒</span> LocalAI
        </h1>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 
                   text-white rounded-lg transition-colors font-medium text-sm"
        >
          <PlusIcon />
          New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`sidebar-btn group ${
              activeConversationId === conv.id ? 'active' : ''
            }`}
          >
            <span className="flex-1 truncate text-sm">{conv.title}</span>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded 
                       text-slate-400 hover:text-red-400 transition-all"
              title="Delete conversation"
            >
              <TrashIcon />
            </button>
          </div>
        ))}

        {conversations.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            No conversations yet.
            <br />
            Start a new chat!
          </p>
        )}
      </div>

      {/* Model Status Section */}
      <div className="border-t border-slate-700">
        <ModelStatus />
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          All data stays on your device
        </p>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10l-1 11H4L3 4zM6 4V2h4v2M2 4h12" />
    </svg>
  );
}
