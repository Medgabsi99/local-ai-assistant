import { useState, useEffect } from 'react';
import { sendToWorker } from '../workers/worker-bridge';

export default function ModelStatus() {
  const [modelStates, setModelStates] = useState({
    embedding: { loaded: false, loading: false },
    llm: { loaded: false, loading: false },
    whisper: { loaded: false, loading: false },
  });
  const [progress, setProgress] = useState({});

  const checkModels = async () => {
    for (const model of ['embedding', 'llm', 'whisper']) {
      try {
        const result = await sendToWorker('CHECK_MODEL', {
          modelName: model,
        });
        setModelStates((prev) => ({
          ...prev,
          [model]: { ...prev[model], loaded: result.loaded },
        }));
      } catch {
        // Model not loaded
      }
    }
  };

  const loadModel = async (modelName) => {
    setModelStates((prev) => ({
      ...prev,
      [modelName]: { ...prev[modelName], loading: true },
    }));

    try {
      await sendToWorker('LOAD_MODEL', { modelName }, {
        onProgress: (data) => {
          setProgress((prev) => ({ ...prev, [modelName]: data.progress }));
        },
      });

      setModelStates((prev) => ({
        ...prev,
        [modelName]: { loaded: true, loading: false },
      }));
    } catch (error) {
      console.error(`Failed to load ${modelName}:`, error);
      setModelStates((prev) => ({
        ...prev,
        [modelName]: { loaded: false, loading: false },
      }));
    }
  };

  useEffect(() => {
    checkModels();
  }, []);

  const models = [
    { key: 'embedding', label: 'Embedding Model', icon: '🧬', size: '~75MB' },
    { key: 'llm', label: 'Language Model', icon: '🧠', size: '~2GB' },
    { key: 'whisper', label: 'Whisper (Speech)', icon: '🎤', size: '~1.5GB' },
  ];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Local Models
      </h3>

      {models.map(({ key, label, icon, size }) => {
        const state = modelStates[key];
        const modelProgress = progress[key] || 0;

        return (
          <div key={key} className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{size}</p>
                </div>
              </div>
              <StatusDot loaded={state.loaded} loading={state.loading} />
            </div>

            {state.loading && (
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
            )}

            {!state.loaded && !state.loading && (
              <button
                onClick={() => loadModel(key)}
                className="w-full mt-2 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 
                         text-white rounded-md transition-colors"
              >
                Download Model
              </button>
            )}

            {state.loaded && (
              <p className="text-xs text-emerald-400 mt-1">✓ Ready</p>
            )}
          </div>
        );
      })}
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
