import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/i18n";
import {
  getAllDocuments,
  getDocument,
  deleteDocument,
  deleteDocumentVectors,
  updateDocument,
} from "../db/database";
import { useRAG } from "../hooks/useRAG";

export default function DocumentPane() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagSaveError, setTagSaveError] = useState("");
  const { processPDF, processText, isProcessing, progress, getStats } = useRAG();
  const [storeStats, setStoreStats] = useState(null);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => { const docs = await getAllDocuments(); setDocuments(docs); }, []);
  const loadStats = useCallback(async () => { try { const stats = await getStats(); setStoreStats(stats); } catch {} }, [getStats]);

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
      if (file.type === "application/pdf") { await processPDF(file); }
      else if (file.type === "text/plain" || file.name.endsWith(".md") || file.name.endsWith(".csv")) { const content = await file.text(); await processText(content, file.name, file.type); }
      else { setError("Unsupported file type."); return; }
      await loadDocuments(); await loadStats();
    } catch (err) { setError(err.message); }
    e.target.value = "";
  };

  const handleViewDocument = async (docId) => {
    if (selectedDoc === docId) { setSelectedDoc(null); setDocContent(""); setTagInput(""); setTagSaveError(""); return; }
    const doc = await getDocument(docId);
    setSelectedDoc(docId); setDocContent(doc?.content || ""); setTagInput((doc?.tags || []).join(", ")); setTagSaveError("");
  };

  const handleDelete = async (docId) => {
    await deleteDocument(docId); await deleteDocumentVectors(docId);
    if (selectedDoc === docId) { setSelectedDoc(null); setDocContent(""); setTagInput(""); setTagSaveError(""); }
    await loadDocuments(); await loadStats();
  };

  const getFileIcon = (fileType) => {
    if (fileType === "application/pdf") return "📕";
    if (fileType === "text/plain") return "📄";
    if (fileType?.includes("markdown") || fileType?.includes("md")) return "📝";
    if (fileType?.includes("csv")) return "📊";
    return "📎";
  };

  const filteredDocuments = documents.filter((document) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return document.title.toLowerCase().includes(q) || (document.content || "").toLowerCase().includes(q) || (document.tags || []).some((tag) => tag.toLowerCase().includes(q));
  });

  const selectedDocument = documents.find((document) => document.id === selectedDoc);

  const handleSaveTags = async () => {
    if (!selectedDoc) return;
    try { const tags = parseTags(tagInput); await updateDocument(selectedDoc, { tags }); await loadDocuments(); setTagSaveError(""); } catch (error) { setTagSaveError(error.message); }
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-emerald-500/5'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('bg-emerald-500/5'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-emerald-500/5'); const file = e.dataTransfer.files[0]; if (file) { const input = document.querySelector('input[type="file"]'); if (input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); } } }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('documents')}</h2>
            <label className={`px-3 py-1.5 text-white text-sm rounded-lg cursor-pointer transition-colors ${isProcessing ? "bg-slate-600 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"}`}>
              {isProcessing ? t('processing') : "+ " + t('upload')}
              <input type="file" accept=".pdf,.txt,.md,.csv" onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
            </label>
          </div>
          <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-muted)' }}>{t('upload')}</p>
          <label className="block mb-3">
            <span className="sr-only">{t('search')}</span>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('search_conv')} className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </label>
          {isProcessing && (
            <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{progress.message}</p>
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
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}><p>📊 {storeStats.totalVectors} vectors</p><p>📁 {storeStats.totalDocuments} {t('documents')}</p></div>
          )}
          {documents.length > 0 && searchQuery.trim() && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{storeStats?.totalDocuments} {t('documents')}</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 && !isProcessing && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('no_documents')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('upload')} PDF, TXT, MD, CSV</p>
            </div>
          )}
          {filteredDocuments.map((doc) => (
            <div key={doc.id} onClick={() => handleViewDocument(doc.id)} className={`rounded-lg p-3 cursor-pointer transition-colors hover:bg-slate-750 ${selectedDoc === doc.id ? "ring-2 ring-emerald-500" : ""}`} style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                  {(doc.tags || []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{doc.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>#{tag}</span>)}</div>}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(doc.createdAt).toLocaleDateString()} · {(doc.content?.length / 1000).toFixed(1)} KB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} className="p-1 rounded opacity-0 group-hover:opacity-100 transition-colors" style={{ color: 'var(--text-muted)' }}><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedDoc && docContent ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{selectedDocument?.title || t('documents')}</h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{(docContent.length / 1000).toFixed(1)} KB · {docContent.split(/\s+/).length} words</span>
            </div>
            <div className="mb-4 rounded-xl p-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Tags</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Separate with commas.</p>
              <div className="flex gap-2 mt-2">
                <textarea value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="research, pdf, ideas" rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <button onClick={handleSaveTags} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-medium text-white">{t('save')}</button>
              </div>
              {(selectedDocument?.tags || []).length > 0 && <div className="mt-3 flex flex-wrap gap-1">{selectedDocument.tags.map((tag) => <span key={tag} className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>#{tag}</span>)}</div>}
            </div>
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)' }}>
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed" style={{ color: 'var(--text-primary)' }}>{docContent.slice(0, 10000)}</pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('no_documents')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseTags(value) { return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20); }

function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10l-1 11H4L3 4zM6 4V2h4v2M2 4h12"/></svg>;
}