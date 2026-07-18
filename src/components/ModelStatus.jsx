import { useState, useEffect, useCallback } from 'react';
import { t } from '../lib/i18n';
import { ai } from '../workers/worker-bridge';

export default function ModelStatus() {
  const [modelStates, setModelStates] = useState({
    embedding: { loaded: false, loading: false, name: 'all-MiniLM-L6-v2' },
    llm: { loaded: false, loading: false, name: 'LaMini-Flan-T5-783M' },
    whisper: { loaded: false, loading: false, name: 'Whisper Tiny EN' },
  });
  const [progress, setProgress] = useState({});
  const [downloadInfo, setDownloadInfo] = useState({});
  const [error, setError] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('LaMini-Flan-T5-783M');

  // Fetch available models
  useEffect(() => {
    (async () => {
      try {
        const result = await ai.getAvailableModels();
        if (result?.models) {
          setAvailableModels(result.models);
          setSelectedModel(result.models[0]);
        }
      } catch (e) { console.warn('Available models:', e); }
    })();
  }, []);

  const checkModels = useCallback(async () => {
    try {
      const result = await ai.checkAllModels();
      const states = {};
      for (const [key, info] of Object.entries(result.statuses)) {
        states[key] = {
          ...modelStates[key],
          loaded: info.loaded,
          loading: info.loading,
          name: info.name,
          size: info.size,
        };
        if (info.download) {
          setDownloadInfo((prev) => ({ ...prev, [key]: info.download }));
        }
      }
      setModelStates((prev) => ({ ...prev, ...states }));
    } catch {
      // Ignore - models not checked yet
    }
  }, []);

  useEffect(() => {
    checkModels();
  }, [checkModels]);

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
          if (data.speed || data.eta) {
            setDownloadInfo((prev) => ({
              ...prev,
              [modelName]: {
                speed: data.speed,
                eta: data.eta,
                bytesDownloaded: data.bytesDownloaded,
                totalBytes: data.totalBytes,
              },
            }));
          }
        },
      });

      setModelStates((prev) => ({
        ...prev,
        [modelName]: { ...prev[modelName], loaded: true, loading: false },
      }));
      setProgress((prev) => ({ ...prev, [modelName]: 100 }));
    } catch (err) {
      if (err.message === 'Download cancelled by user') {
        setModelStates((prev) => ({
          ...prev,
          [modelName]: { ...prev[modelName], loading: false },
        }));
        return;
      }
      setError(`Failed to load ${modelName}: ${err.message}`);
      setModelStates((prev) => ({
        ...prev,
        [modelName]: { ...prev[modelName], loaded: false, loading: false },
      }));
    }
  };

  const switchAndLoadModel = async () => {
    if (!selectedModel) return;
    // Switch the model config
    try {
      await ai.switchLLMModel(selectedModel);
      // Now download/load the new model
      await loadModel('llm');
      await checkModels();
    } catch (err) {
      setError(`Failed to switch model: ${err.message}`);
    }
  };

  const cancelDownload = async (modelName) => {
    await ai.cancelDownload(modelName);
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
      label: t('model_embedding'),
      icon: '🧬',
      desc: '',
      size: '~80MB',
      required: true,
    },
    {
      key: 'llm',
      label: t('model_language'),
      icon: '🧠',
      desc: '',
      size: modelStates.llm.size || '~1.5GB',
      required: true,
    },
    {
      key: 'whisper',
      label: t('model_whisper'),
      icon: '🎤',
      desc: '',
      size: '~150MB',
      required: false,
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {t('local_models')}
      </h3>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('local_models_desc')}
      </p>

      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-2">
          <p className="text-xs text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300 mt-1">
            {t('clear')}
          </button>
        </div>
      )}

      {models.map(({ key, label, icon, desc, size, required }) => {
        const state = modelStates[key];
        const modelProgress = progress[key] || 0;

        return (
          <div
            key={key}
            className="rounded-lg p-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {label}
                    </p>
                    {required && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                      >
                        {t('required')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {desc}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {size}
                  </p>
                </div>
              </div>
              <StatusDot loaded={state.loaded} loading={state.loading} />
            </div>

            {/* LLM model selector */}
            {key === 'llm' && availableModels.length > 0 && (
              <div
                className="mb-3 p-2.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}
              >
                <p className="text-[10px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t('switch_model')}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {availableModels.map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedModel(m)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-md transition-all font-medium ${
                          selectedModel === m ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : ''
                        }`}
                        style={{
                          background: selectedModel === m ? undefined : 'var(--bg-hover)',
                          color: selectedModel === m ? undefined : 'var(--text-secondary)',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {selectedModel}
                    </span>
                    {!state.loaded && !state.loading && (
                      <button
                        onClick={switchAndLoadModel}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-[0.97]"
                      >
                        {t('download')}
                      </button>
                    )}
                    {state.loading && <span className="text-[11px] text-yellow-400">{t('downloading')}</span>}
                    {state.loaded && selectedModel !== availableModels[0] && (
                      <button
                        onClick={switchAndLoadModel}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-[0.97]"
                      >
                        {t('switch_model')}
                      </button>
                    )}
                    {state.loaded && selectedModel === availableModels[0] && (
                      <span className="text-[11px] text-emerald-400">✓ {t('active')}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {state.loading && (
              <>
                <div className="w-full rounded-full h-1.5 mb-2" style={{ background: 'var(--bg-tertiary)' }}>
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
                {downloadInfo[key] && (
                  <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    <span>{downloadInfo[key].speed || 'Starting...'}</span>
                    <span>{downloadInfo[key].eta || 'Calculating...'}</span>
                  </div>
                )}
                <button
                  onClick={() => cancelDownload(key)}
                  className="w-full px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md transition-colors"
                >
                  {t('cancel')}
                </button>
              </>
            )}

            <div className="flex gap-2">
              {!state.loaded && !state.loading && key !== 'llm' && (
                <button
                  onClick={() => loadModel(key)}
                  className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                >
                  {t('download')} ({size})
                </button>
              )}
              {!state.loaded && !state.loading && key === 'llm' && (
                <button
                  onClick={() => loadModel(key)}
                  className="flex-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors"
                >
                  {t('download_default')} ({size})
                </button>
              )}
              {state.loaded && (
                <button
                  onClick={() => unloadModel(key)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-md transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                >
                  {t('unload')}
                </button>
              )}
            </div>

            {state.loaded && <p className="text-xs text-emerald-400 mt-1">✓ {t('active')}</p>}
          </div>
        );
      })}

      {/* Memory warning */}
      <div
        className="rounded-lg p-2"
        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}
      >
        <p className="text-xs text-amber-400">{t('memory_warning')}</p>
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
      className={`h-3 w-3 rounded-full ${loaded ? 'bg-emerald-500' : ''}`}
      style={{ background: loaded ? undefined : 'var(--text-muted)' }}
    />
  );
}
