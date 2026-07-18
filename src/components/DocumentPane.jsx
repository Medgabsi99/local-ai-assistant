import { useState, useEffect, useCallback } from 'react';
import { t } from '../lib/i18n';
import { getAllDocuments, getDocument, deleteDocument, deleteDocumentVectors, updateDocument } from '../db/database';
import { DOC_PREVIEW_MAX_CHARS, TAGS_MAX_COUNT } from '../lib/constants';
import { useRAG } from '../hooks/useRAG';
import PdfViewer from './PdfViewer';
import { BarChart3, FileText, Folder, Search, Trash2, Paperclip, File } from 'lucide-react';

export default function DocumentPane() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagSaveError, setTagSaveError] = useState('');
  const { processPDF, processText, isProcessing, progress, getStats } = useRAG();
  const [storeStats, setStoreStats] = useState(null);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => { const docs = await getAllDocuments(); setDocuments(docs); }, []);
  const loadStats = useCallback(async () => { try { const stats = await getStats(); setStoreStats(stats); } catch (e) { console.warn('Stats:', e); } }, [getStats]);

  useEffect(() => {
    let ignore = false;
    (async () => { const [docs, stats] = await Promise.all([getAllDocuments(), getStats()]); if (!ignore) { setDocuments(docs); setStoreStats(stats); } })();
    return () => { ignore = true; };
  }, [getStats]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || isProcessing) return;
    setError(null);
    try {
      if (file.type === 'application/pdf') { await processPDF(file); }
      else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.csv')) { const content = await file.text(); await processText(content, file.name, file.type); }
      else { setError('Unsupported file type.'); return; }
      await loadDocuments(); await loadStats();
    } catch (err) { setError(err.message); }
    e.target.value = '';
  };

  const handleViewDocument = async (docId) => {
    if (selectedDoc === docId) { setSelectedDoc(null); setDocContent(''); setTagInput(''); setTagSaveError(''); return; }
    const doc = await getDocument(docId);
    setSelectedDoc(docId); setDocContent(doc?.content || ''); setTagInput((doc?.tags || []).join(', ')); setTagSaveError('');
  };

  const handleDelete = async (docId) => {
    await deleteDocument(docId); await deleteDocumentVectors(docId);
    if (selectedDoc === docId) { setSelectedDoc(null); setDocContent(''); setTagInput(''); setTagSaveError(''); }
    await loadDocuments(); await loadStats();
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'application/pdf') return <File size={20} />;
    if (fileType === 'text/plain') return <FileText size={20} />;
    if (fileType?.includes('markdown') || fileType?.includes('md')) return <FileText size={20} />;
    if (fileType?.includes('csv')) return <BarChart3 size={20} />;
    return <Paperclip size={20} />;
  };

  const filteredDocuments = documents.filter((document) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return document.title.toLowerCase().includes(q) || (document.content || '').toLowerCase().includes(q) || (document.tags || []).some((tag) => tag.toLowerCase().includes(q));
  });

  const selectedDocument = documents.find((document) => document.id === selectedDoc);

  const handleSaveTags = async () => {
    if (!selectedDoc) return;
    try { const tags = parseTags(tagInput); await updateDocument(selectedDoc, { tags }); await loadDocuments(); setTagSaveError(''); } catch (error) { setTagSaveError(error.message); }
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="w-full md:w-80 border-r border-slate-700 flex flex-col md:max-h-full max-h-[40vh]">
        <div className="p-4 border-b border-slate-700" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-emerald-500/5'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('bg-emerald-500/5'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-emerald-500/5'); const file = e.dataTransfer.files[0]; if (file) { const input = document.querySelector('input[type="file"]'); if (input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); } } }}>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold">{t('documents')}</h2>
            <label className={`px-3 py-1.5 text-white text-sm rounded-lg cursor-pointer transition-colors ${isProcessing ? 'bg-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {isProcessing ? t('processing') : '+ ' + t('upload')}
              <input type="file" accept=".pdf,.txt,.md,.csv" onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
            </label>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="text-[10px] text-center mt-1">{t('upload')}</p>
          <label className="block mb-3">
            <span className="sr-only">{t('search')}</span>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('search_conv')} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30" />
          </label>
          {isProcessing && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} className="rounded-lg p-3 mb-3">
              <p style={{ color: 'var(--text-secondary)' }} className="text-xs mb-1">{progress.message}</p>
              <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress.progress}%` }} />
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-red-300">{error}</p>
              <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300 mt-1">{t('clear')}</button>
            </div>
          )}
          {storeStats && storeStats.totalVectors > 0 && (
            <div style={{ color: 'var(--text-muted)' }} className="text-xs"><p><BarChart3 size={12} className="inline mr-1" />{storeStats.totalVectors} {t('vectors')}</p><p><Folder size={12} className="inline mr-1" />{storeStats.totalDocuments} {t('documents')}</p></div>
          )}
          {documents.length > 0 && searchQuery.trim() && <p style={{ color: 'var(--text-muted)' }} className="mt-2 text-xs">{storeStats?.totalDocuments} {t('documents')}</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 && !isProcessing && (
            <div className="text-center py-12">
              <Folder size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm">{t('no_documents')}</p>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-1">{t('upload')} PDF, TXT, MD, CSV</p>
            </div>
          )}
          {filteredDocuments.map((doc) => (
            <div key={doc.id} onClick={() => handleViewDocument(doc.id)} style={{ background: 'var(--bg-card)' }} className={`rounded-lg p-3 cursor-pointer transition-colors hover:bg-slate-750 ${selectedDoc === doc.id ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--text-muted)' }} className="text-xl">{getFileIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-primary)' }} className="text-sm font-medium truncate">{doc.title}</p>
                  {(doc.tags || []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{doc.tags.slice(0, 3).map((tag) => <span key={tag} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} className="rounded-full px-2 py-0.5 text-[11px]">#{tag}</span>)}</div>}
                  <p style={{ color: 'var(--text-muted)' }} className="text-xs">{new Date(doc.createdAt).toLocaleDateString()} · {(doc.content?.length / 1000).toFixed(1)} KB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} style={{ color: 'var(--text-muted)' }} className="p-1 rounded hover:text-red-400 transition-colors" title={t('del')}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto min-w-0">
        {selectedDoc && docContent ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-medium">{selectedDocument?.title || t('documents')}</h3>
              <span style={{ color: 'var(--text-muted)' }} className="text-xs">{(docContent.length / 1000).toFixed(1)} KB · {docContent.split(/\s+/).length} words</span>
            </div>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} className="mb-4 rounded-xl p-4">
              <p style={{ color: 'var(--text-primary)' }} className="text-sm font-medium">{t('tags')}</p>
              <p style={{ color: 'var(--text-muted)' }} className="text-xs">{t('separate_with')}</p>
              <div className="flex gap-2 mt-2">
                <textarea value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={t('tags_placeholder')} rows={2} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                <button onClick={handleSaveTags} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-medium text-white">{t('save')}</button>
              </div>
              {(selectedDocument?.tags || []).length > 0 && <div className="mt-3 flex flex-wrap gap-1">{selectedDocument.tags.map((tag) => <span key={tag} style={{ background: 'var(--accent-light)', color: 'var(--accent)' }} className="rounded-full px-2 py-0.5 text-xs">#{tag}</span>)}</div>}
            </div>
            {selectedDocument?.fileType === 'application/pdf' ? (
              <div style={{ border: '1px solid var(--border)', height: '70vh' }} className="rounded-xl overflow-hidden">
                <PdfViewer docContent={docContent} />
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: 'calc(100vh - 16rem)' }} className="rounded-xl overflow-y-auto">
                <pre style={{ color: 'var(--text-primary)' }} className="text-sm whitespace-pre-wrap font-sans leading-relaxed p-6">{docContent.slice(0, DOC_PREVIEW_MAX_CHARS)}</pre>
                {docContent.length > DOC_PREVIEW_MAX_CHARS && <p style={{ color: 'var(--text-muted)' }} className="text-xs px-6 pb-6">... (showing first {DOC_PREVIEW_MAX_CHARS.toLocaleString()} characters)</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <FileText size={40} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }} className="text-sm ml-3">{t('no_documents')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseTags(value) { return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, TAGS_MAX_COUNT); }