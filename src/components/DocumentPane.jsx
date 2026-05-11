import { useState, useEffect } from 'react';
import { getAllDocuments, saveDocument } from '../db/database';

export default function DocumentPane() {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);

    try {
      let content = '';

      if (file.type === 'application/pdf') {
        content = `[PDF Content: ${file.name} - Full extraction coming in Phase 2]`;
      } else if (file.type === 'text/plain') {
        content = await file.text();
      } else {
        content = `[File: ${file.name}] - Unsupported format preview`;
      }

      await saveDocument({
        title: file.name,
        content,
        fileType: file.type,
      });

      await loadDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Documents</h2>
        <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm 
                        rounded-lg cursor-pointer transition-colors">
          {isUploading ? 'Uploading...' : '+ Add'}
          <input
            type="file"
            accept=".pdf,.txt,.md,.csv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📁</p>
          <p className="text-slate-400 text-sm">No documents yet</p>
          <p className="text-slate-500 text-xs mt-1">
            Upload PDFs or text files to chat with them
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-800 rounded-lg p-3 hover:bg-slate-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {doc.fileType === 'application/pdf' ? '📕' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(doc.createdAt).toLocaleDateString()} ·{' '}
                    {(doc.content.length / 1000).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <p className="text-xs text-slate-500 text-center">
          
        </p>
      </div>
    </div>
  );
}
