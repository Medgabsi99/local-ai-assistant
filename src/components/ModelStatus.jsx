import { useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';

export default function ModelStatus() {
  const [modelStates, setModelStates] = useState({
    embedding: { loaded: false, loading: false, name: 'all-MiniLM-L6-v2' },
    llm: { loaded: false, loading: false, name: 'LaMini-Flan-T5-783M' },
    whisper: { loaded: false, loading: false, name: 'Whisper Tiny EN' },
  });
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);

  const checkModels = async () => {
    for (const model of ['embedding', 'llm', 'whisper']) {
      try {
        const result = await ai.checkModel(model);
        setModelStates((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            loaded: result.loaded,
            loading: result.loading,
          },
        }));
      } catch {
        // Model not loaded - that's fine
      }
    }
  };

  useEffect(() => {
    checkModels();
  }, []);

  const loadModel = async (modelName) => {
    setModelStates((prev) => ({
      ...prev,
      [modelName]: { ...prev[modelName], loading: true },
    }));
    setError(null);

    try {
      await ai.loadModel(modelName, {
        onProgress: (data) => {
          setProgress((prev) => ({ ...prev, [modelName]: data.progress }));
        },
      });

      setModelStates((prev) => ({
        ...prev,
        [modelName]: { ...prev[modelName], loaded: true, loading: false },
      }));
      setProgress((prev) => ({ ...prev, [modelName]: 100 }));
    } catch (err) {
      console.error(`Failed to load ${modelName}:`, err);
      setModelStates((prev) => ({
        ...prev,
        [modelName]: { ...prev[modelName], loaded: false, loading: false },
      }));
      setError(`Failed to load ${modelName}: ${err.message}`);
    }
  };

  const unloadModel = async (modelName) => {
    await ai.unloadModel(modelName);
    setModelStates((prev) => ({
      ...prev,
      [modelName]: { ...prev[modelName], loaded: false, loading: false },
    }));
    setProgress((prev) => ({ ...prev, [modelName]: 0 }));
  };

  const models = [
    {
      key: 'embedding',
      label: 'Embedding Model',
      icon: '🧬',
      desc: 'For document search (RAG)',
      size: '~80MB',
      required: true,
    },
    {
      key: 'llm',
      label: 'Language Model',
      icon: '🧠',
      desc: 'For chat responses',
      size: '~1.5GB',
      required: true,
    },
    {
      key: 'whisper',
      label: 'Whisper (Speech)',
      icon: '🎤',
      desc: 'For audio transcription',
      size: '~150MB',
      required: false,
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Local Models
      </h3>

      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-2">
          <p className="text-xs text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-400 hover:text-red-300 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Models are downloaded once and cached in your browser.
      </p>

      {models.map(({ key, label, icon, desc, size, required }) => {
        const state = modelStates[key];
        const modelProgress = progress[key] || 0;

        return (
          <div key={key} className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    {required && (
                      <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{desc}</p>
                  <p className="text-xs text-slate-600">{size}</p>
                </div>
              </div>
              <StatusDot loaded={state.loaded} loading={state.loading} />
            </div>

            {state.loading && (
              <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
            )}

            <div className="flex gap-2">
              {!state.loaded && !state.loading && (
                <button
                  onClick={() => loadModel(key)}
                  className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 
                           text-white rounded-md transition-colors"
                >
                  Download ({size})
                </button>
              )}

              {state.loaded && (
                <button
                  onClick={() => unloadModel(key)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 
                           text-slate-300 rounded-md transition-colors"
                >
                  Unload (Free memory)
                </button>
              )}
            </div>

            {state.loaded && (
              <p className="text-xs text-emerald-400 mt-1">✓ Ready</p>
            )}
          </div>
        );
      })}

      {/* Memory warning */}
      <div className="bg-amber-900/30 border border-amber-800/50 rounded-lg p-2">
        <p className="text-xs text-amber-400">
          ⚠️ Loading all models requires ~1.7GB of disk space.
          LLM inference may be slow on older devices.
        </p>
      </div>
    </div>
  );
}

function StatusDot({ loaded, loading }) {
  if (loading) {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
      </span>
    );
  }

  return (
    <span
      className={`h-3 w-3 rounded-full ${
        loaded ? 'bg-emerald-500' : 'bg-slate-600'
      }`}
    />
  );
}
