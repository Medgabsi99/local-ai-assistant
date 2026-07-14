import { useState, useEffect, useRef } from 'react';

// Simple PDF viewer that renders pages as canvases
// Uses the main-thread PDF.js API (no worker needed for basic rendering)
export default function PdfViewer({ docContent }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!docContent) return;
    setLoading(true);
    
    // Simulate page breaks at paragraph boundaries for plain text rendering
    const paragraphs = docContent.split('\n\n');
    const pageSize = 40; // paragraphs per page
    const total = Math.max(1, Math.ceil(paragraphs.length / pageSize));
    setTotalPages(total);
    
    const pageData = [];
    for (let i = 0; i < total; i++) {
      const start = i * pageSize;
      const end = Math.min(start + pageSize, paragraphs.length);
      pageData.push(paragraphs.slice(start, end).join('\n\n'));
    }
    setPages(pageData);
    setLoading(false);
  }, [docContent]);

  if (!docContent) return null;

  return (
    <div className="flex flex-col h-full">
      {/* PDF Toolbar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>◀</button>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {currentPage} / {totalPages}
            </span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded text-xs hover:bg-white/5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>▶</button>
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{docContent.length > 1000 ? `${(docContent.length / 1000).toFixed(0)}KB` : `${docContent.length}B`}</span>
        </div>
      )}

      {/* Page Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-primary)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1.5">
              <span className="typing-dot" style={{ animationDelay: '0ms' }} />
              <span className="typing-dot" style={{ animationDelay: '150ms' }} />
              <span className="typing-dot" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto rounded-xl p-8 shadow-lg" style={{ background: '#fafaf9', color: '#1c1917' }}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed font-serif">
              {pages[currentPage - 1] || ''}
            </p>
            <div className="mt-6 pt-4 border-t border-stone-200 text-center text-[10px] text-stone-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}