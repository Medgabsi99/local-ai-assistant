import { useState, useEffect, useRef } from 'react';

export default function PdfViewer({ docContent }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!docContent) return;
    setLoading(true);

    const paragraphs = docContent.split('\n\n');
    const pageSize = Math.max(1, Math.round(40 * (100 / zoom)));
    const total = Math.max(1, Math.ceil(paragraphs.length / pageSize));
    setTotalPages(total);

    const pageData = [];
    for (let i = 0; i < total; i++) {
      const start = i * pageSize;
      const end = Math.min(start + pageSize, paragraphs.length);
      pageData.push(paragraphs.slice(start, end).join('\n\n'));
    }
    setPages(pageData);
    if (currentPage > total) setCurrentPage(1);
    setLoading(false);
  }, [docContent, zoom, currentPage]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!docContent) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }} className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
            className="text-xs px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30" style={{ color: 'var(--text-secondary)' }} aria-label="Previous page">
            ◀
          </button>
          <span style={{ color: 'var(--text-primary)' }} className="text-xs font-medium">
            {currentPage} / {totalPages}
          </span>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
            className="text-xs px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30" style={{ color: 'var(--text-secondary)' }} aria-label="Next page">
            ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">{(docContent.length / 1000).toFixed(1)} KB</span>
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">{docContent.split(/\s+/).length} words</span>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }} aria-label="Zoom out">−</button>
            <span style={{ color: 'var(--text-primary)' }} className="text-[10px] font-medium w-8 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="text-xs px-1.5 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }} aria-label="Zoom in">+</button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} className="rounded-xl p-8 shadow-lg">
              <pre style={{ color: 'var(--text-primary)', fontSize: `${zoom / 100 * 0.875}rem` }} className="whitespace-pre-wrap font-sans leading-relaxed">
                {pages[currentPage - 1] || ''}
              </pre>
            </div>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
                className="text-xs px-3 py-1.5 rounded-md disabled:opacity-30" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }} aria-label="Previous page">
                ← Previous
              </button>
              <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">Page {currentPage} of {totalPages}</span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
                className="text-xs px-3 py-1.5 rounded-md disabled:opacity-30" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }} aria-label="Next page">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}