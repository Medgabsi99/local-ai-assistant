import { t } from '../lib/i18n';

export default function SearchBar({
  searchQuery, setSearchQuery, searchIndex, setSearchIndex,
  filterRole, setFilterRole, searchResults, totalMatchCount, searchInputRef,
  showSearch, setShowSearch,
}) {
  if (!showSearch) return null;
  return (
    <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        <input ref={searchInputRef} value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); }}
          placeholder={t('search_messages')}
          className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        {searchQuery.trim() && (
          <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length} msgs · ${totalMatchCount} matches` : '0 matches'}
          </span>
        )}
        <div className="flex gap-0.5">
          {['all', 'user', 'assistant'].map((role) => (
            <button key={role} onClick={() => { setFilterRole(role); setSearchIndex(0); }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${filterRole === role ? 'bg-emerald-500/20 text-emerald-300' : ''}`}
              style={{ background: filterRole === role ? undefined : 'var(--bg-hover)', color: filterRole === role ? undefined : 'var(--text-muted)' }}>
              {role === 'all' ? 'All' : role === 'user' ? 'User' : 'AI'}
            </button>
          ))}
        </div>
        <button onClick={() => setSearchIndex(i => Math.max(0, i - 1))} disabled={searchResults.length === 0}
          className="text-xs disabled:opacity-30 px-1" style={{ color: 'var(--text-muted)' }} aria-label="Previous match">▲</button>
        <button onClick={() => setSearchIndex(i => Math.min(searchResults.length - 1, i + 1))} disabled={searchResults.length === 0}
          className="text-xs disabled:opacity-30 px-1" style={{ color: 'var(--text-muted)' }} aria-label="Next match">▼</button>
        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}
          className="text-xs px-1" style={{ color: 'var(--text-muted)' }} aria-label="Close search">✕</button>
      </div>
    </div>
  );
}