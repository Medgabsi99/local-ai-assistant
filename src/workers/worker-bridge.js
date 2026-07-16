// ============================================================
// Worker Bridge - Clean async communication for all workers
// ============================================================

let aiWorker = null;
let pdfWorker = null;
let audioWorker = null;
let pendingRequests = new Map();
let requestId = 0;

function getAIWorker() {
  if (!aiWorker) {
    aiWorker = new Worker(new URL('./ai.worker.js', import.meta.url), {
      type: 'module',
    });
    aiWorker.onmessage = handleMessage;
  }
  return aiWorker;
}

function getPDFWorker() {
  if (!pdfWorker) {
    pdfWorker = new Worker(new URL('./pdf-extractor.js', import.meta.url), {
      type: 'module',
    });
    pdfWorker.onmessage = handleMessage;
  }
  return pdfWorker;
}

function getAudioWorker() {
  if (!audioWorker) {
    audioWorker = new Worker(new URL('./audio-processor.js', import.meta.url), {
      type: 'module',
    });
    audioWorker.onmessage = handleMessage;
  }
  return audioWorker;
}

function handleMessage(event) {
  const { id, type } = event.data;
  const pending = pendingRequests.get(id);

  if (!pending) return;

  if (type === 'ERROR') {
    pending.reject(new Error(event.data.error));
    pendingRequests.delete(id);
    return;
  }

  // Streaming tokens
  if (type === 'TOKEN') {
    if (pending.onToken) {
      pending.onToken(event.data.token, event.data.fullText);
    }
    return;
  }

  // Progress updates
  if (type === 'PROGRESS') {
    if (pending.onProgress) {
      pending.onProgress(event.data);
    }
    return;
  }

  // Recording data chunks (streaming audio)
  if (type === 'RECORDING_DATA') {
    if (pending.onData) {
      pending.onData(event.data);
    }
    return;
  }

  // Terminal states for all workers
  const terminalTypes = [
    'MODEL_LOADED',
    'MODEL_STATUS',
    'ALL_MODEL_STATUSES',
    'MODEL_UNLOADED',
    'ALL_MODELS_UNLOADED',
    'DOWNLOAD_CANCELLED',
    'MODEL_SWITCHED',
    'AVAILABLE_MODELS',
    'CANCEL_ACKNOWLEDGED',
    'DOWNLOAD_PROGRESS_ALL',
    'INFERENCE_COMPLETE',
    'INFERENCE_CANCELLED',
    'EMBEDDING_RESULT',
    'EMBEDDINGS_BATCH_RESULT',
    'TRANSCRIPTION_RESULT',
    'EXTRACTION_COMPLETE',
    'CHUNK_COMPLETE',
    'RECORDING_STARTED',
    'RECORDING_COMPLETE',
    'RECORDING_PAUSED',
    'RECORDING_RESUMED',
    'RECORDING_CANCELLED',
    'RECORDING_STATUS',
    'RECORDING_ERROR',
  ];

  if (terminalTypes.includes(type)) {
    pending.resolve(event.data);
    pendingRequests.delete(id);
  }
}

function send(workerGetter, type, payload, callbacks = {}) {
  const id = ++requestId;
  const worker = workerGetter();

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
      onToken: callbacks.onToken,
      onProgress: callbacks.onProgress,
      onData: callbacks.onData,
    });
    worker.postMessage({ type, payload, id });
  });
}

// Send a fire-and-forget message (no response expected)
function sendFireForget(workerGetter, type, payload) {
  try {
    workerGetter().postMessage({ type, payload });
  } catch {}
}

export const ai = {
  loadModel: (modelName, callbacks) => send(getAIWorker, 'LOAD_MODEL', { modelName }, callbacks),
  cancelDownload: (modelName) => send(getAIWorker, 'CANCEL_DOWNLOAD', { modelName }),
  cancelInference: () => sendFireForget(getAIWorker, 'CANCEL_INFERENCE', {}),
  runInference: (payload, callbacks) => send(getAIWorker, 'RUN_INFERENCE', payload, callbacks),
  getEmbedding: (text, callbacks) => send(getAIWorker, 'GET_EMBEDDING', { text }, callbacks),
  getEmbeddingsBatch: (texts, callbacks) => send(getAIWorker, 'GET_EMBEDDINGS_BATCH', { texts }, callbacks),
  checkModel: (modelName) => send(getAIWorker, 'CHECK_MODEL', { modelName }),
  checkAllModels: () => send(getAIWorker, 'CHECK_ALL_MODELS', {}),
  unloadModel: (modelName) => send(getAIWorker, 'UNLOAD_MODEL', { modelName }),
  unloadAll: () => send(getAIWorker, 'UNLOAD_ALL', {}),
  transcribeAudio: (audioData, callbacks) => send(getAIWorker, 'TRANSCRIBE_AUDIO', { audioData }, callbacks),
  getDownloadProgress: () => send(getAIWorker, 'GET_DOWNLOAD_PROGRESS', {}),
  switchLLMModel: (modelKey) => send(getAIWorker, 'SWITCH_LLM_MODEL', { modelKey }),
  getAvailableModels: () => send(getAIWorker, 'GET_AVAILABLE_MODELS', {}),
};

export const pdf = {
  extract: (arrayBuffer, filename, callbacks) =>
    send(getPDFWorker, 'EXTRACT_PDF', { arrayBuffer, filename }, callbacks),
  chunkText: (text, options, callbacks) => send(getPDFWorker, 'CHUNK_TEXT', { text, options }, callbacks),
};

export const audio = {
  startRecording: (options, callbacks) => send(getAudioWorker, 'START_RECORDING', options || {}, callbacks),
  stopRecording: (callbacks) => send(getAudioWorker, 'STOP_RECORDING', {}, callbacks),
  pauseRecording: () => send(getAudioWorker, 'PAUSE_RECORDING', {}),
  resumeRecording: () => send(getAudioWorker, 'RESUME_RECORDING', {}),
  getStatus: () => send(getAudioWorker, 'GET_RECORDING_STATUS', {}),
  cancelRecording: () => send(getAudioWorker, 'CANCEL_RECORDING', {}),
};

export function terminateAll() {
  [aiWorker, pdfWorker, audioWorker].forEach((worker) => {
    if (worker) worker.terminate();
  });
  aiWorker = null;
  pdfWorker = null;
  audioWorker = null;
  pendingRequests.clear();
}
