import { useState, useEffect, useRef } from 'react';
import { t } from '../lib/i18n';
import { ai } from '../workers/worker-bridge';
import {
  getAllConversations,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  toggleConversationPinned,
  archiveConversation,
  getConversationMessages,
} from '../db/database';
import ModelStatus from './ModelStatus';
import { Lock, Plus, Settings, ChevronLeft, ChevronRight, Pin, Pencil, ClipboardList, Archive, Trash2, Download } from 'lucide-react';

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'];

function getDateGroup(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Older';
}

export default function Sidebar({ activeConversationId, onSelectConversation, onNewConversation, onOpenSettings }) {
  const [conversations, setConversations] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [anyLoading, setAnyLoading] = useState(false);
  const renameRef = useRef(null);

  const load = async () => { setConversations(await getAllConversations()); };
  useEffect(() => { load(); }, [activeConversationId]);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await ai.checkAllModels();
        if (r?.statuses) setAnyLoading(Object.values(r.statuses).some((s) => s.loading));
      } catch {}
    };
    check();
    const i = setInterval(check, 3000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { if (renaming) renameRef.current?.select(); }, [renaming]);

  const newChat = async () => { const id = await createConversation(); await load(); onNewConversation(id); };
  const del = async (e, id) => { e.stopPropagation(); await deleteConversation(id); await load(); if (activeConversationId === id) onNewConversation(null); };
  const togglePin = async (e, id, pinned) => { e.stopPropagation(); await toggleConversationPinned(id, !pinned); await load(); };
  const startRename = (e, conv) => { e.stopPropagation(); setRenaming(conv.id); setRenameVal(conv.title); };
  const finishRename = async () => { if (renaming && renameVal.trim()) { await updateConversationTitle(renaming, renameVal.trim()); await load(); } setRenaming(null); setRenameVal(''); };
  const handleRenameKey = (e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenaming(null); };

  const filtered = conversations.filter((c) => {
    if (showArchived !== !!c.archived) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = {};
  for (const c of filtered) { const g = getDateGroup(c.updatedAt); if (!grouped[g]) grouped[g] = []; grouped[g].push(c); }

  if (collapsed) {
    return (
      <div className="h-full w-14 flex flex-col items-center py-3 gap-3 flex-shrink-0" style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>
        <button onClick={() => setCollapsed(false)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5" aria-label="Expand sidebar"><ChevronRight size={16} /></button>
        <button onClick={newChat} className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg" aria-label={t('new_chat')}><Plus size={16} /></button>
        <div className="flex-1" />
        <button onClick={onOpenSettings} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5" aria-label={t('settings')}><Settings size={16} /></button>
      </div>
    );
  }

  return (
    <div className="h-full w-64 flex flex-col flex-shrink-0" style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>
      <div className="p-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Lock size={14} className="text-emerald-400" /> {t('app_name')}
          {anyLoading && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full whitespace-nowrap animate-pulse">⬇</span>}
        </h1>
        <div className="flex items-center gap-0.5">
          <button onClick={onOpenSettings} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label={t('settings')}><Settings size={14} /></button>
          <button onClick={() => setCollapsed(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Collapse sidebar"><ChevronLeft size={14} /></button>
        </div>
      </div>

      <div className="p-3 flex-shrink-0">
        <button onClick={newChat} className="w-full h-9 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg transition-all duration-200 active:scale-[0.97] text-sm font-medium" aria-label={t('new_chat')}>
          <Plus size={14} /> {t('new_chat')}
        </button>
      </div>

      <div className="px-3 pb-2 flex-shrink-0">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search_conv')}
          className="w-full h-8 text-xs px-3 rounded-lg outline-none focus:border-emerald-500/50 transition-colors"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5">
        {filtered.length === 0 && <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('no_conv')}</p>}
        {GROUP_ORDER.map((group) => {
          const items = grouped[group];
          if (!items?.length) return null;
          return (
            <div key={group}>
              <p className="text-[10px] font-medium px-1 py-2" style={{ color: 'var(--text-muted)' }}>{t(group.toLowerCase().replace(' ', '_'))}</p>
              {items.map((conv) => (
                <div key={conv.id} onClick={() => onSelectConversation(conv.id)}
                  className={`sidebar-btn group ${activeConversationId === conv.id ? 'active' : ''}`}>
                  {renaming === conv.id ? (
                    <input ref={renameRef} value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={finishRename} onKeyDown={handleRenameKey}
                      className="flex-1 bg-slate-700 border border-emerald-500/50 rounded px-1 py-0.5 text-xs text-white outline-none"
                      onClick={(e) => e.stopPropagation()} />
                  ) : (
                    <span className="flex-1 truncate text-xs">{conv.title}</span>
                  )}
                  {renaming !== conv.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => togglePin(e, conv.id, conv.pinned)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 hover:bg-white/5" aria-label={conv.pinned ? 'Unpin' : 'Pin'}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill={conv.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M5 2.5h6l-.5 3 2 2v1l-3 .5V14l-1.5-1.5-1.5 1.5V9l-3-.5v-1l2-2-.5-3z"/></svg>
                      </button>
                      <button onClick={(e) => startRename(e, conv)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-white/5" aria-label="Rename"><Pencil size={10} /></button>
                      <button onClick={async (e) => { e.stopPropagation(); const msgs = await getConversationMessages(conv.id); const json = JSON.stringify({ title: conv.title, messages: msgs, exportedAt: new Date().toISOString() }, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${conv.title.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.json`; a.click(); URL.revokeObjectURL(url); }} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-white/5" aria-label="Export JSON"><Download size={10} /></button>
                      <button onClick={async (e) => { e.stopPropagation(); await archiveConversation(conv.id, !showArchived); await load(); if (activeConversationId === conv.id) onNewConversation(null); }} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-white/5" aria-label={showArchived ? 'Restore' : 'Archive'}><Archive size={10} /></button>
                      <button onClick={(e) => del(e, conv.id)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-white/5" aria-label={t('del')}><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="overflow-y-auto max-h-[260px] flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <ModelStatus />
      </div>

      <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>{t('all_data_device')}</p>
      </div>
    </div>
  );
}