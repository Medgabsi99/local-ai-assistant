import { useState, useEffect } from 'react';
import { ai } from '../workers/worker-bridge';

export function useModelStatus() {
  const [embeddingModelReady, setEmbeddingModelReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await ai.checkAllModels();
        if (!cancelled) {
          const anyLoaded = Object.values(r.statuses || {}).some((s) => s.loaded || s.loading);
          setModelsLoading(!anyLoaded);
          setEmbeddingModelReady(r.statuses?.embedding?.loaded || false);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { modelsLoading, embeddingModelReady };
}