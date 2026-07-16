import { pipeline, env } from '@xenova/transformers';

try {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
} catch (e) {
  console.warn('Failed to configure transformers env:', e);
}

const AVAILABLE_LLM_MODELS = {
  'LaMini-Flan-T5-783M': {
    name: 'Xenova/LaMini-Flan-T5-783M',
    revision: 'main',
    type: 'text2text-generation',
    size: '~1.5GB',
    desc: 'Balanced quality & speed',
  },
  'TinyLlama-1.1B': {
    name: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    revision: 'main',
    type: 'text-generation',
    size: '~700MB',
    desc: 'Small & fast',
  },
  'Qwen1.5-0.5B': {
    name: 'Xenova/Qwen1.5-0.5B-Chat',
    revision: 'main',
    type: 'text-generation',
    size: '~1.2GB',
    desc: 'Modern architecture',
  },
};

const MODEL_CONFIGS = {
  embedding: {
    name: 'Xenova/all-MiniLM-L6-v2',
    revision: 'main',
    type: 'feature-extraction',
    size: '~80MB',
    instance: null,
    loading: false,
    loaded: false,
    downloadController: null,
  },
  llm: {
    name: 'Xenova/LaMini-Flan-T5-783M',
    revision: 'main',
    type: 'text2text-generation',
    size: '~1.5GB',
    instance: null,
    loading: false,
    loaded: false,
    downloadController: null,
  },
  whisper: {
    name: 'Xenova/whisper-tiny.en',
    revision: 'main',
    type: 'automatic-speech-recognition',
    size: '~150MB',
    instance: null,
    loading: false,
    loaded: false,
    downloadController: null,
  },
};

let activeDownloads = {};

let inferenceAbortController = null;

self.onmessage = async function (event) {
  const { type, payload, id } = event.data;
  try {
    switch (type) {
      case 'LOAD_MODEL':
        await handleLoadModel(payload.modelName, id);
        break;
      case 'SWITCH_LLM_MODEL':
        await handleSwitchLLM(payload.modelKey, id);
        break;
      case 'GET_AVAILABLE_MODELS':
        self.postMessage({
          type: 'AVAILABLE_MODELS',
          models: Object.keys(AVAILABLE_LLM_MODELS),
          details: AVAILABLE_LLM_MODELS,
          id,
        });
        break;
      case 'CANCEL_DOWNLOAD':
        handleCancelDownload(payload.modelName, id);
        break;
      case 'CANCEL_INFERENCE':
        if (inferenceAbortController) {
          inferenceAbortController.abort();
          inferenceAbortController = null;
        }
        self.postMessage({ type: 'INFERENCE_CANCELLED', id });
        break;
      case 'RUN_INFERENCE':
        await handleInference(payload, id);
        break;
      case 'GET_EMBEDDING':
        await handleGetEmbedding(payload.text, id);
        break;
      case 'GET_EMBEDDINGS_BATCH':
        await handleGetEmbeddingsBatch(payload.texts, id);
        break;
      case 'CHECK_MODEL':
        handleCheckModel(payload.modelName, id);
        break;
      case 'CHECK_ALL_MODELS':
        handleCheckAllModels(id);
        break;
      case 'UNLOAD_MODEL':
        handleUnloadModel(payload.modelName, id);
        break;
      case 'UNLOAD_ALL':
        handleUnloadAll(id);
        break;
      case 'TRANSCRIBE_AUDIO':
        await handleTranscribeAudio(payload.audioData, id);
        break;
      case 'GET_DOWNLOAD_PROGRESS':
        handleGetDownloadProgress(id);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown type: ${type}`, id });
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message, stack: error.stack, id });
  }
};

async function handleSwitchLLM(modelKey, id) {
  const modelInfo = AVAILABLE_LLM_MODELS[modelKey];
  if (!modelInfo) {
    self.postMessage({ type: 'ERROR', error: `Unknown model: ${modelKey}`, id });
    return;
  }
  if (MODEL_CONFIGS.llm.instance) {
    MODEL_CONFIGS.llm.instance = null;
    MODEL_CONFIGS.llm.loaded = false;
  }
  MODEL_CONFIGS.llm.name = modelInfo.name;
  MODEL_CONFIGS.llm.type = modelInfo.type;
  MODEL_CONFIGS.llm.size = modelInfo.size;
  self.postMessage({ type: 'MODEL_SWITCHED', modelKey, id });
}

async function handleLoadModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  if (!config) throw new Error(`Unknown model: ${modelName}`);
  if (config.loaded) {
    self.postMessage({ type: 'MODEL_LOADED', modelName, id });
    return;
  }
  if (config.loading) {
    self.postMessage({
      type: 'PROGRESS',
      status: 'loading',
      message: `Already loading ${modelName}...`,
      progress: activeDownloads[modelName]?.progress || 50,
      id,
    });
    return;
  }
  config.loading = true;
  const startTime = Date.now();
  activeDownloads[modelName] = { progress: 0, bytesDownloaded: 0, totalBytes: 0, startTime, status: 'starting' };
  self.postMessage({
    type: 'PROGRESS',
    status: 'loading',
    message: `Preparing to download ${config.name}...`,
    progress: 0,
    id,
  });
  try {
    const ac = new AbortController();
    config.downloadController = ac;
    config.instance = await pipeline(config.type, config.name, {
      revision: config.revision,
      progress_callback: (p) => {
        if (ac.signal.aborted) throw new Error('Download cancelled by user');
        if (p.status === 'downloading') {
          const percent = Math.round((p.loaded / p.total) * 90);
          activeDownloads[modelName] = {
            ...activeDownloads[modelName],
            progress: Math.min(10 + percent, 90),
            bytesDownloaded: p.loaded,
            totalBytes: p.total,
            status: 'downloading',
            speed: calculateSpeed(p.loaded, startTime),
            eta: calculateETA(p.loaded, p.total, startTime),
          };
          self.postMessage({
            type: 'PROGRESS',
            status: 'loading',
            message: `Downloading ${config.name} (${formatBytes(p.loaded)} / ${formatBytes(p.total)})`,
            progress: activeDownloads[modelName].progress,
            ...activeDownloads[modelName],
            id,
          });
        } else if (p.status === 'initiate') {
          self.postMessage({
            type: 'PROGRESS',
            status: 'loading',
            message: `Initializing ${config.name}...`,
            progress: 5,
            id,
          });
        }
      },
    });
    if (ac.signal.aborted) {
      config.loading = false;
      config.instance = null;
      delete activeDownloads[modelName];
      self.postMessage({ type: 'DOWNLOAD_CANCELLED', modelName, id });
      return;
    }
    config.loaded = true;
    config.loading = false;
    config.downloadController = null;
    activeDownloads[modelName] = { progress: 100, status: 'complete', completedAt: Date.now() };
    self.postMessage({ type: 'PROGRESS', status: 'complete', message: `${config.name} ready!`, progress: 100, id });
    self.postMessage({ type: 'MODEL_LOADED', modelName, id });
  } catch (error) {
    config.loading = false;
    config.downloadController = null;
    if (error.message === 'Download cancelled by user') {
      delete activeDownloads[modelName];
      self.postMessage({ type: 'DOWNLOAD_CANCELLED', modelName, id });
      return;
    }
    delete activeDownloads[modelName];
    throw error;
  }
}

function handleCancelDownload(modelName, id) {
  const c = MODEL_CONFIGS[modelName];
  if (c?.downloadController) c.downloadController.abort();
  self.postMessage({ type: 'CANCEL_ACKNOWLEDGED', modelName, id });
}
function handleGetDownloadProgress(id) {
  self.postMessage({
    type: 'DOWNLOAD_PROGRESS_ALL',
    downloads: { ...activeDownloads },
    models: Object.fromEntries(
      Object.entries(MODEL_CONFIGS).map(([k, v]) => [k, { loaded: v.loaded, loading: v.loading }]),
    ),
    id,
  });
}
function handleCheckModel(modelName, id) {
  const c = MODEL_CONFIGS[modelName];
  self.postMessage({
    type: 'MODEL_STATUS',
    modelName,
    loaded: c?.loaded || false,
    loading: c?.loading || false,
    download: activeDownloads[modelName] || null,
    id,
  });
}
function handleCheckAllModels(id) {
  const s = {};
  for (const [k, v] of Object.entries(MODEL_CONFIGS))
    s[k] = { loaded: v.loaded, loading: v.loading, name: v.name, size: v.size, download: activeDownloads[k] || null };
  self.postMessage({ type: 'ALL_MODEL_STATUSES', statuses: s, id });
}
function handleUnloadModel(n, id) {
  const c = MODEL_CONFIGS[n];
  if (c) {
    c.instance = null;
    c.loaded = false;
    c.loading = false;
    c.downloadController = null;
  }
  delete activeDownloads[n];
  self.postMessage({ type: 'MODEL_UNLOADED', n, id });
}
function handleUnloadAll(id) {
  for (const c of Object.values(MODEL_CONFIGS)) {
    c.instance = null;
    c.loaded = false;
    c.loading = false;
    c.downloadController = null;
  }
  activeDownloads = {};
  self.postMessage({ type: 'ALL_MODELS_UNLOADED', id });
}

async function handleGetEmbedding(text, id) {
  const c = MODEL_CONFIGS.embedding;
  if (!c.loaded) throw new Error('Embedding model not loaded.');
  const t = Date.now();
  const o = await c.instance(text, { pooling: 'mean', normalize: true });
  self.postMessage({
    type: 'EMBEDDING_RESULT',
    embedding: Array.from(o.data),
    dimension: o.data.length,
    timeMs: Date.now() - t,
    id,
  });
}

async function handleGetEmbeddingsBatch(texts, id) {
  const c = MODEL_CONFIGS.embedding;
  if (!c.loaded) throw new Error('Embedding model not loaded.');
  const embeddings = [];
  const t = Date.now();
  for (let i = 0; i < texts.length; i++) {
    self.postMessage({
      type: 'PROGRESS',
      status: 'embedding',
      message: `Embedding ${i + 1}/${texts.length}...`,
      progress: Math.round((i / texts.length) * 100),
      current: i + 1,
      total: texts.length,
      id,
    });
    const o = await c.instance(texts[i], { pooling: 'mean', normalize: true });
    embeddings.push(Array.from(o.data));
  }
  self.postMessage({
    type: 'EMBEDDINGS_BATCH_RESULT',
    embeddings,
    totalChunks: texts.length,
    totalTimeMs: Date.now() - t,
    id,
  });
}

async function handleInference(payload, id) {
  const { modelName, input, context, history, webContext, maxTokens = 512, temperature = 0.3 } = payload;
  const config = MODEL_CONFIGS[modelName];
  if (!config?.loaded) throw new Error(`Model ${modelName} not loaded.`);

  let prompt = '';
  if (context?.length) prompt += 'Document context:\n' + context.join('\n\n') + '\n\n';
  if (webContext) prompt += 'Web search results:\n' + webContext + '\n\n';
  if (history) prompt += history + '\n';
  prompt += input;

  const startTime = Date.now();
  self.postMessage({ type: 'PROGRESS', status: 'generating', message: 'Generating...', progress: 0, id });

  try {
    if (config.type === 'text-generation') {
      let prev = 0,
        streamed = '';
      const gen = await config.instance(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        do_sample: temperature > 0,
        callback_function: (tokens) => {
          try {
            if (tokens[0]?.length > prev) {
              const p = config.instance.tokenizer.decode(tokens[0].slice(prev), { skip_special_tokens: true });
              if (p) {
                streamed += p;
                self.postMessage({ type: 'TOKEN', token: p, fullText: streamed, id });
              }
              prev = tokens[0].length;
            }
          } catch {}
        },
      });
      const r = Array.isArray(gen) ? gen[0] : gen;
      self.postMessage({
        type: 'INFERENCE_COMPLETE',
        result: r?.generated_text || r?.text || streamed,
        timeMs: Date.now() - startTime,
        promptLength: prompt.length,
        id,
      });
    } else {
      const r = await config.instance(prompt, { max_new_tokens: maxTokens, temperature, do_sample: temperature > 0 });
      const t =
        typeof r === 'string'
          ? r
          : Array.isArray(r)
            ? r[0]?.generated_text || r[0]?.text || ''
            : r.generated_text || r.text || '';
      self.postMessage({
        type: 'INFERENCE_COMPLETE',
        result: t,
        timeMs: Date.now() - startTime,
        promptLength: prompt.length,
        id,
      });
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: `Inference failed: ${error.message}`, stack: error.stack, id });
  }
}

async function handleTranscribeAudio(audioData, id) {
  const c = MODEL_CONFIGS.whisper;
  if (!c?.loaded) throw new Error('Whisper not loaded.');
  const t = Date.now();
  self.postMessage({ type: 'PROGRESS', status: 'transcribing', message: 'Processing audio...', progress: 20, id });
  try {
    const r = await c.instance(audioData, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    self.postMessage({
      type: 'TRANSCRIPTION_RESULT',
      text: r.text,
      chunks: r.chunks || [],
      timeMs: Date.now() - t,
      id,
    });
  } catch {
    const r = await c.instance(audioData, { chunk_length_s: 30, return_timestamps: false });
    self.postMessage({ type: 'TRANSCRIPTION_RESULT', text: r.text, timeMs: Date.now() - t, fallback: true, id });
  }
}

function calculateSpeed(b, t) {
  const e = (Date.now() - t) / 1000;
  return e === 0 ? 'Calculating...' : formatBytes(b / e) + '/s';
}
function calculateETA(b, total, t) {
  if (b === 0) return 'Calculating...';
  const e = (Date.now() - t) / 1000,
    bps = b / e,
    rem = (total - b) / bps;
  return rem < 60 ? `${Math.round(rem)}s` : `${Math.round(rem / 60)}m ${Math.round(rem % 60)}s`;
}
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024,
    s = ['B', 'KB', 'MB', 'GB'];
  return (
    parseFloat((bytes / Math.pow(k, Math.floor(Math.log(bytes) / Math.log(k)))).toFixed(1)) +
    ' ' +
    s[Math.floor(Math.log(bytes) / Math.log(k))]
  );
}
