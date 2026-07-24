import { t } from '../lib/i18n';
import { Search, X, ChevronUp, ChevronDown, Filter } from 'lucide-react';

export default function SearchBar({
  searchQuery,
  setSearchQuery,
  searchIndex,
  setSearchIndex,
  filterRole,
  setFilterRole,
  searchResults,
  totalMatchCount,
  searchInputRef,
  showSearch,
  setShowSearch,
}) {
  if (!showSearch) return null;

  return (
    <div
      className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
    >
      <Search size={14} style={{ color: 'var(--text-muted)' }} />
      <input
        ref={searchInputRef}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('search_messages')}
        autoFocus
        className="flex-1 bg-transparent text-xs outline-none"
        style={{ color: 'var(--text-primary)' }}
        aria-label={t('search_messages')}
      />
      {searchQuery && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {totalMatchCount > 0 ? `${searchIndex + 1}/${totalMatchCount}` : '0/0'}
          </span>
          <button
            onClick={() => setSearchIndex(Math.max(0, searchIndex - 1))}
            disabled={totalMatchCount === 0}
            className="btn-icon disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('previous_match')}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => setSearchIndex(Math.min(totalMatchCount - 1, searchIndex + 1))}
            disabled={totalMatchCount === 0}
            className="btn-icon disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('next_match')}
          >
            <ChevronDown size={12} />
          </button>
          <div className="flex items-center gap-1 pl-1.5 border-l" style={{ borderColor: 'var(--border)' }}>
            <Filter size={12} style={{ color: 'var(--text-muted)' }} />
            {['all', 'user', 'assistant'].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-all ${
                  filterRole === role ? 'ring-1' : 'hover:bg-white/5'
                }`}
                style={{
                  background: filterRole === role ? 'var(--accent-light)' : 'transparent',
                  color: filterRole === role ? 'var(--accent)' : 'var(--text-muted)',
                  ringColor: filterRole === role ? 'var(--accent-ring)' : 'transparent',
                }}
              >
                {role === 'all' ? t('filter_all') : role === 'user' ? t('filter_user') : t('filter_ai')}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="btn-icon"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('close_search')}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
