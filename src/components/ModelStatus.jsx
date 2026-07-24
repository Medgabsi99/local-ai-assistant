import { useState, useEffect, useCallback } from 'react';
import { ai } from '../workers/worker-bridge';
import { t } from '../lib/i18n';
import { Download, Trash2, X, Check, Loader2 } from 'lucide-react';

export default function ModelStatus() {
  const [modelStates, setModelStates] = useState({});
  const [progress, setProgress] = useState({});
  const [downloadInfo, setDownloadInfo] = useState({});
  const [error, setError] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await ai.getAvailableModels();
        if (result?.models) {
          setAvailableModels(result.models);
          setSelectedModel(result.models[0]);
        }
      } catch (e) {
        console.warn('Available models:', e);
      }
    })();
  }, []);

  const checkModels = useCallback(async () => {
    try {
      const result = await ai.checkAllModels();
      const states = {};
      for (const [key, info] of Object.entries(result.statuses)) {
        states[key] = { loaded: info.loaded, loading: info.loading, name: info.name, size: info.size };
        if (info.download) setDownloadInfo((prev) => ({ ...prev, [key]: info.download }));
      }
      setModelStates((prev) => ({ ...prev, ...states }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    checkModels().catch(() => {});
  }, [checkModels]);

  const loadModel = async (modelName) => {
    setModelStates((prev) => ({ ...prev, [modelName]: { ...prev[modelName], loading: true } }));
    setError(null);
    try {
      await ai.loadModel(modelName, {
        onProgress: (data) => {
          setProgress((prev) => ({ ...prev, [modelName]: data.progress }));
          if (data.speed || data.eta)
            setDownloadInfo((prev) => ({
              ...prev,
              [modelName]: {
                speed: data.speed,
                eta: data.eta,
                bytesDownloaded: data.bytesDownloaded,
                totalBytes: data.totalBytes,
              },
            }));
        },
      });
      setModelStates((prev) => ({ ...prev, [modelName]: { ...prev[modelName], loaded: true, loading: false } }));
      setProgress((prev) => ({ ...prev, [modelName]: 100 }));
    } catch (err) {
      if (err.message === 'Download cancelled by user') {
        setModelStates((prev) => ({ ...prev, [modelName]: { ...prev[modelName], loading: false } }));
        return;
      }
      setError(`Failed to load ${modelName}: ${err.message}`);
      setModelStates((prev) => ({ ...prev, [modelName]: { ...prev[modelName], loaded: false, loading: false } }));
    }
  };

  const switchAndLoadModel = async () => {
    if (!selectedModel) return;
    try {
      await ai.switchLLMModel(selectedModel);
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
    setModelStates((prev) => ({ ...prev, [modelName]: { ...prev[modelName], loaded: false, loading: false } }));
    setProgress((prev) => ({ ...prev, [modelName]: 0 }));
  };

  const models = [
    { key: 'embedding', label: t('model_embedding'), icon: '🧬', size: '~80MB', required: true },
    { key: 'llm', label: t('model_language'), icon: '🧠', size: modelStates.llm?.size || '~1.5GB', required: true },
    { key: 'whisper', label: t('model_whisper'), icon: '🎤', size: '~150MB', required: false },
    { key: 'vision', label: 'Image Understanding', icon: '📷', size: '~600MB', required: false },
  ];

  return (
    <div className="p-3 space-y-2.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
        {t('local_models')}
      </h3>
      {error && (
        <div
          className="rounded-xl p-2.5 flex items-start gap-2"
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
      {models.map(({ key, label, icon, size, required }) => {
        const state = modelStates[key];
        const modelProgress = progress[key] || 0;
        return (
          <div key={key} className="card card-hover p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">{icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {label}
                    </p>
                    {required && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                      >
                        {t('required')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {size}
                  </p>
                </div>
              </div>
              {state?.loading ? (
                <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />
              ) : state?.loaded ? (
                <Check size={14} className="shrink-0" style={{ color: 'var(--accent)' }} />
              ) : (
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--text-muted)' }} />
              )}
            </div>

            {/* LLM model selector */}
            {key === 'llm' && availableModels.length > 0 && (
              <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-hover)' }}>
                <p className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('switch_model')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedModel(m)}
                      className={`text-[10px] px-2 py-1 rounded-md font-medium transition-all ${selectedModel === m ? 'ring-1' : 'hover:bg-white/5'}`}
                      style={{
                        background: selectedModel === m ? 'var(--accent-light)' : 'transparent',
                        color: selectedModel === m ? 'var(--accent)' : 'var(--text-secondary)',
                        ringColor: selectedModel === m ? 'var(--accent-ring)' : 'transparent',
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
                  {!state?.loaded && !state?.loading && (
                    <button
                      onClick={switchAndLoadModel}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-[0.97]"
                    >
                      {t('download')}
                    </button>
                  )}
                  {state?.loaded && selectedModel !== availableModels[0] && (
                    <button
                      onClick={switchAndLoadModel}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-[0.97]"
                    >
                      {t('switch_model')}
                    </button>
                  )}
                  {state?.loaded && selectedModel === availableModels[0] && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                      ✓ {t('active')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {state?.loading && (
              <div className="space-y-1.5">
                <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${modelProgress}%`, background: 'var(--accent)' }}
                  />
                </div>
                {downloadInfo[key] && (
                  <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{downloadInfo[key].speed || 'Starting...'}</span>
                    <span>{downloadInfo[key].eta || 'Calculating...'}</span>
                  </div>
                )}
                <button
                  onClick={() => cancelDownload(key)}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                >
                  <X size={10} /> {t('cancel')}
                </button>
              </div>
            )}

            {/* Action buttons */}
            {!state?.loaded && !state?.loading && (
              <button
                onClick={() => loadModel(key)}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg transition-all active:scale-[0.97]"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                <Download size={10} />{' '}
                {key === 'llm' ? `${t('download_default')} (${size})` : `${t('download')} (${size})`}
              </button>
            )}
            {state?.loaded && (
              <button
                onClick={() => unloadModel(key)}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              >
                <Trash2 size={10} /> {t('unload')}
              </button>
            )}
          </div>
        );
      })}
      <div
        className="rounded-xl p-2.5 flex items-start gap-2"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}
      >
        <span className="text-amber-400 text-xs">⚠️</span>
        <p className="text-[10px]" style={{ color: '#fbbf24' }}>
          {t('memory_warning')}
        </p>
      </div>
    </div>
  );
}
