import { useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';
import { getVectorStore } from '../workers/vector-store';
import { db } from '../db/database';
import VectorStoreManager from './VectorStoreManager';

export default function SettingsModal({ isOpen, onClose }) {
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [showVectorManager, setShowVectorManager] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      estimateStorage();
    }
  }, [isOpen]);

  const estimateStorage = async () => {
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate) {
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentUsed: estimate.quota
            ? Math.round((estimate.usage / estimate.quota) * 100)
            : 0,
        });
      }
    } catch {
      // Storage API not supported
    }
  };

  const handleClearAllData = async () => {
    if (!confirm(
      '⚠️ This will delete ALL local data including:\n\n' +
      '• All conversations and messages\n' +
      '• All uploaded documents\n' +
      '• All vector embeddings\n' +
      '• All cached AI models\n\n' +
      'This cannot be undone. Are you sure?'
    )) {
      return;
    }

    setClearing(true);
    try {
      // Clear IndexedDB
      await db.delete();
      await db.open();

      // Clear vector store
      const store = await getVectorStore();
      await store.clear();

      // Clear model caches
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        await caches.delete(key);
      }

      // Unload all models
      await ai.unloadAll();

      alert('All data cleared. The page will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear all data: ' + error.message);
    }
    setClearing(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Storage */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3">Storage</h3>
              {storageEstimate ? (
                <div className="bg-slate-900 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-400">Used</span>
                    <span className="text-sm text-slate-200">
                      {formatBytes(storageEstimate.usage)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${storageEstimate.percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{storageEstimate.percentUsed}% used</span>
                    <span>Quota: {formatBytes(storageEstimate.quota)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Storage info not available</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => setShowVectorManager(true)}
                className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 
                         text-slate-200 rounded-lg text-sm transition-colors text-left"
              >
                🧬 Manage Vector Store
              </button>

              <button
                onClick={handleClearAllData}
                disabled={clearing}
                className="w-full px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 
                         text-red-400 rounded-lg text-sm transition-colors
                         border border-red-800/50 disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : '🗑 Clear All Data'}
              </button>
            </div>

            {/* Info */}
            <div className="bg-slate-900 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <p>🔒 All data is stored locally in your browser</p>
              <p>📡 No data is ever sent to external servers</p>
              <p>💾 Models are cached from Hugging Face CDN</p>
              <p>🧠 AI runs entirely on your device</p>
            </div>
          </div>
        </div>
      </div>

      <VectorStoreManager
        isOpen={showVectorManager}
        onClose={() => setShowVectorManager(false)}
      />
    </>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
