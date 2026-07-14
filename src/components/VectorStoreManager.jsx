import { useState, useEffect, useCallback } from "react";
import { getAllDocuments } from "../db/database";
import { getVectorStore } from "../lib/vector-store-access";

export default function VectorStoreManager({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const store = await getVectorStore();
      const storeStats = await store.getStats();
      setStats(storeStats);

      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load vector store data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        void loadData();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [isOpen, loadData]);

  const handleClearVectors = async () => {
    if (
      !confirm(
        "Are you sure? This will remove all vector embeddings. Documents will remain, but RAG search will stop working until you re-upload files.",
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const store = await getVectorStore();
      await store.clear();
      await loadData();
    } catch (error) {
      console.error("Failed to clear vectors:", error);
    }
    setClearing(false);
  };

  const estimateStorageSize = () => {
    if (!stats || stats.totalVectors === 0) return "0 KB";
    // Each float32 is 4 bytes, each vector is ~384 dimensions
    const bytesPerVector = stats.dimension * 4;
    const totalBytes = stats.totalVectors * bytesPerVector;
    return formatBytes(totalBytes);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Vector Store Manager</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <span className="animate-spin text-2xl">⏳</span>
            <p className="text-slate-400 text-sm mt-2">Loading...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Vectors"
                value={stats?.totalVectors || 0}
                icon="🧬"
              />
              <StatCard
                label="Documents"
                value={stats?.totalDocuments || 0}
                icon="📄"
              />
              <StatCard
                label="Dimensions"
                value={stats?.dimension || 384}
                icon="📐"
              />
            </div>

            {/* Storage estimate */}
            <div className="bg-slate-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">
                  Estimated Storage
                </span>
                <span className="text-sm font-mono text-emerald-400">
                  {estimateStorageSize()}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (stats?.totalVectors || 0) / 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Stored in Origin Private File System (OPFS)
              </p>
            </div>

            {/* Document List */}
            {documents.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Indexed Documents
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          {doc.fileType === "application/pdf" ? "📕" : "📄"}
                        </span>
                        <span className="text-sm text-slate-300 truncate max-w-50">
                          {doc.title}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {(doc.content?.length / 1000).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClearVectors}
                disabled={clearing || !stats?.totalVectors}
                className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50
                         text-red-400 rounded-lg text-sm transition-colors border border-red-800/50"
              >
                {clearing ? "Clearing..." : "Clear All Vectors"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 
                         text-slate-300 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500 text-center">
              Clearing vectors only removes embeddings. Your documents stay
              intact. Re-upload files to regenerate vectors.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-slate-900 rounded-xl p-3 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
