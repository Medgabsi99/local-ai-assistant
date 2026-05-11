import { useState, useEffect, useCallback } from 'react';
import {
  getAllDocuments,
  getDocument,
  deleteDocument,
} from '../db/database';
import { useRAG } from '../hooks/useRAG';

export default function DocumentPane() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState('');
  const { processPDF, processText, isProcessing, progress, getStats } = useRAG();
  const [storeStats, setStoreStats] = useState(null);
  const [error, setError] = useState(null);

  const loadDocuments = useCallback(async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const stats = await getStats();
      setStoreStats(stats);
    } catch {
      // Vector store might be empty
    }
  }, [getStats]);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [loadDocuments, loadStats]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || isProcessing) return;

    setError(null);

    try {
      if (file.type === 'application/pdf') {
        await processPDF(file);
      } else if (
        file.type === 'text/plain' ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv')
      ) {
        const content = await file.text();
        await processText(content, file.name, file.type);
      } else {
        setError('Unsupported file type. Please upload PDF, TXT, MD, or CSV files.');
        return;
      }

      await loadDocuments();
      await loadStats();
    } catch (err) {
      setError(err.message);
    }

    // Reset file input
    e.target.value = '';
  };

  const handleViewDocument = async (docId) => {
    if (selectedDoc === docId) {
      setSelectedDoc(null);
      setDocContent('');
      return;
    }

    const doc = await getDocument(docId);
    setSelectedDoc(docId);
    setDocContent(doc?.content || '');
  };

  const handleDelete = async (docId) => {
    await deleteDocument(docId);
    if (selectedDoc === docId) {
      setSelectedDoc(null);
      setDocContent('');
    }
    await loadDocuments();
    await loadStats();
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'application/pdf') return '📕';
    if (fileType === 'text/plain') return '📄';
    if (fileType?.includes('markdown') || fileType?.includes('md')) return '📝';
    if (fileType?.includes('csv')) return '📊';
    return '📎';
  };

  return (
    <div className="flex h-full">
      {/* Document List */}
      <div className="w-80 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Documents</h2>
            <label
              className={`px-3 py-1.5 text-white text-sm rounded-lg cursor-pointer transition-colors ${
                isProcessing
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isProcessing ? 'Processing...' : '+ Add'}
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div className="bg-slate-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-400 mb-1">{progress.message}</p>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-400 hover:text-red-300 mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Stats */}
          {storeStats && storeStats.totalVectors > 0 && (
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>📊 {storeStats.totalVectors} vectors indexed</p>
              <p>📁 {storeStats.totalDocuments} documents</p>
              <p>🔢 {storeStats.dimension}-dimensional embeddings</p>
            </div>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {documents.length === 0 && !isProcessing && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-slate-400 text-sm">No documents yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Upload PDFs or text files to enable RAG-powered chat
              </p>
            </div>
          )}

          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleViewDocument(doc.id)}
              className={`bg-slate-800 rounded-lg p-3 cursor-pointer transition-colors hover:bg-slate-750 ${
                selectedDoc === doc.id ? 'ring-2 ring-emerald-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(doc.createdAt).toLocaleDateString()} ·{' '}
                    {(doc.content?.length / 1000).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedDoc && docContent ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                {documents.find((d) => d.id === selectedDoc)?.title || 'Document'}
              </h3>
              <span className="text-xs text-slate-500">
                {(docContent.length / 1000).toFixed(1)} KB · {docContent.split(/\s+/).length} words
              </span>
            </div>
            <div className="bg-slate-800 rounded-xl p-6">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {docContent.slice(0, 10000)}
                {docContent.length > 10000 && (
                  <span className="text-slate-500 mt-2 block">
                    ... (showing first 10,000 characters)
                  </span>
                )}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-slate-400 text-sm">Select a document to preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10l-1 11H4L3 4zM6 4V2h4v2M2 4h12" />
    </svg>
  );
}
