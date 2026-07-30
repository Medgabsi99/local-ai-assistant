import { useState, useEffect, useCallback } from 'react';
import { t } from '../lib/i18n';
import { useRAG } from '../hooks/useRAG';
import { getAllDocuments, getDocument, deleteDocument, updateDocument, deleteDocumentVectors } from '../db/database';
import { DOC_PREVIEW_MAX_CHARS, TAGS_MAX_COUNT } from '../lib/constants';
import PdfViewer from './PdfViewer';
import ConfirmModal from './ConfirmModal';
import Skeleton from './Skeleton';
import {
  FileText,
  File,
  BarChart3,
  Paperclip,
  Folder,
  Trash2,
  Search,
  Upload,
  X,
  Save,
  Tag,
  FileUp,
} from 'lucide-react';

export default function DocumentPane() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagSaveError, setTagSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { processPDF, processText, getStats, isProcessing, progress, error, setError } = useRAG();
  const [storeStats, setStoreStats] = useState(null);

  const loadDocuments = useCallback(async () => {
    setDocuments(await getAllDocuments());
  }, []);
  const loadStats = useCallback(async () => {
    try {
      setStoreStats(await getStats());
    } catch {
      /* ignore */
    }
  }, [getStats]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [docs, stats] = await Promise.all([getAllDocuments(), getStats()]);
      if (!ignore) {
        setDocuments(docs);
        setStoreStats(stats);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [getStats]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || isProcessing) return;
    setError(null);
    try {
      if (file.type === 'application/pdf') await processPDF(file);
      else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        await processText(await file.text(), file.name, file.type);
      } else {
        setError(t('unsupported_file'));
        return;
      }
      await loadDocuments();
      await loadStats();
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  };

  const handleViewDocument = async (docId) => {
    if (selectedDoc === docId) {
      setSelectedDoc(null);
      setDocContent('');
      setTagInput('');
      setTagSaveError('');
      return;
    }
    const doc = await getDocument(docId);
    setSelectedDoc(docId);
    setDocContent(doc?.content || '');
    setTagInput((doc?.tags || []).join(', '));
    setTagSaveError('');
  };

  const promptDelete = (docId) => {
    setDeleteTargetId(docId);
    setShowDeleteConfirm(true);
  };

  const doDelete = async () => {
    if (!deleteTargetId) return;
    await deleteDocument(deleteTargetId);
    await deleteDocumentVectors(deleteTargetId);
    if (selectedDoc === deleteTargetId) {
      setSelectedDoc(null);
      setDocContent('');
      setTagInput('');
      setTagSaveError('');
    }
    await loadDocuments();
    await loadStats();
    setDeleteTargetId(null);
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'application/pdf') return <File size={18} />;
    if (fileType?.includes('markdown') || fileType?.includes('md') || fileType === 'text/plain')
      return <FileText size={18} />;
    if (fileType?.includes('csv')) return <BarChart3 size={18} />;
    return <Paperclip size={18} />;
  };

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.content || '').toLowerCase().includes(q) ||
      (doc.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const selectedDocument = documents.find((doc) => doc.id === selectedDoc);

  const handleSaveTags = async () => {
    if (!selectedDoc) return;
    try {
      const tags = parseTags(tagInput);
      await updateDocument(selectedDoc, { tags });
      await loadDocuments();
      setTagSaveError('');
    } catch (error) {
      setTagSaveError(error.message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div
        className="w-full md:w-80 flex flex-col md:max-h-full max-h-[40vh]"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <div
          className="p-4 space-y-3"
          style={{ borderBottom: '1px solid var(--border)' }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.background = 'var(--accent-light)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.background = '';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file) {
              const input = document.querySelector('input[type="file"]');
              if (input) {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('documents')}
            </h2>
            <label
              className={`interactive flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}
            >
              <Upload size={12} /> {isProcessing ? t('processing') : t('upload')}
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          </div>
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_conv')}
              className="w-full h-8 text-xs pl-7 pr-3 rounded-lg outline-none focus:border-emerald-500/50 transition-colors"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          {isProcessing && (
            <div className="card p-3 space-y-1.5 animate-fade-in">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {progress.message}
              </p>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%`, background: 'var(--accent)' }}
                />
              </div>
            </div>
          )}
          {error && (
            <div
              className="rounded-xl p-2.5 flex items-start gap-2 animate-slide-left"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-xs flex-1" style={{ color: '#f87171' }}>
                {error}
              </p>
              <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-300">
                <X size={12} />
              </button>
            </div>
          )}
          {storeStats?.totalVectors > 0 && (
            <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span>
                <BarChart3 size={10} className="inline mr-1" />
                {storeStats.totalVectors} {t('vectors')}
              </span>
              <span>
                <Folder size={10} className="inline mr-1" />
                {storeStats.totalDocuments} {t('documents')}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <Skeleton count={4} type="card" />
          ) : documents.length === 0 && !isProcessing ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="empty-state-icon">
                <FileUp size={28} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('no_documents')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('no_documents_desc')}
              </p>
            </div>
          ) : null}
          {filteredDocuments.map((doc, i) => (
            <div
              key={doc.id}
              onClick={() => handleViewDocument(doc.id)}
              className={`card card-hover p-3 cursor-pointer list-enter ${selectedDoc === doc.id ? 'ring-1' : ''}`}
              style={{
                ringColor: selectedDoc === doc.id ? 'var(--accent-ring)' : 'transparent',
                animationDelay: `${i * 30}ms`,
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ color: 'var(--text-muted)' }}>{getFileIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {doc.title}
                  </p>
                  {(doc.tags || []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {doc.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(doc.createdAt).toLocaleDateString()} · {(doc.content?.length / 1000).toFixed(1)} {t('kb')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    promptDelete(doc.id);
                  }}
                  className="btn-icon text-slate-500 hover:text-red-400"
                  title={t('del')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto min-w-0">
        {selectedDoc && docContent ? (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedDocument?.title || t('documents')}
              </h3>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('document_size', { size: (docContent.length / 1000).toFixed(1), words: docContent.split(/\s+/).length })}
              </span>
            </div>
            <div className="card p-4 mb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t('tags')}
                </p>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('separate_with')}
              </p>
              <div className="flex gap-2">
                <textarea
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder={t('tags_placeholder')}
                  rows={2}
                  className="flex-1 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500/50 transition-colors resize-none"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={handleSaveTags}
                  className="interactive flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white"
                >
                  <Save size={12} /> {t('save')}
                </button>
              </div>
              {(selectedDocument?.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDocument.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {selectedDocument?.fileType === 'application/pdf' ? (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', height: '70vh' }}>
                <PdfViewer docContent={docContent} />
              </div>
            ) : (
              <div
                className="rounded-xl overflow-y-auto"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  maxHeight: 'calc(100vh - 16rem)',
                }}
              >
                <pre
                  className="text-sm whitespace-pre-wrap font-sans leading-relaxed p-5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {docContent.slice(0, DOC_PREVIEW_MAX_CHARS)}
                </pre>
                {docContent.length > DOC_PREVIEW_MAX_CHARS && (
                  <p className="text-[10px] px-5 pb-5" style={{ color: 'var(--text-muted)' }}>
                    ... (showing first {DOC_PREVIEW_MAX_CHARS.toLocaleString()} characters)
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 animate-fade-in">
            <div className="empty-state-icon">
              <FileText size={28} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('no_documents')}
            </p>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={doDelete}
        title={t('del')}
        message={t('delete_document_confirm')}
        confirmText={t('del')}
        danger
      />
    </div>
  );
}

function parseTags(value) {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].slice(0, TAGS_MAX_COUNT);
}
