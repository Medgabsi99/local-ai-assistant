// ============================================================
// Worker Bridge - Clean async communication
// ============================================================

let aiWorker = null;
let pdfWorker = null;
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

function handleMessage(event) {
  const { id, type } = event.data;
  const pending = pendingRequests.get(id);

  if (!pending) return;

  if (type === 'ERROR') {
    pending.reject(new Error(event.data.error));
    pendingRequests.delete(id);
    return;
  }

  if (type === 'TOKEN') {
    if (pending.onToken) {
      pending.onToken(event.data.token, event.data.fullText);
    }
    return;
  }

  if (type === 'PROGRESS') {
    if (pending.onProgress) {
      pending.onProgress(event.data);
    }
    return;
  }

  // Terminal states
  const terminalTypes = [
    'MODEL_LOADED',
    'MODEL_STATUS',
    'MODEL_UNLOADED',
    'INFERENCE_COMPLETE',
    'EMBEDDING_RESULT',
    'EMBEDDINGS_BATCH_RESULT',
    'TRANSCRIPTION_RESULT',
    'EXTRACTION_COMPLETE',
    'CHUNK_COMPLETE',
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
    });

    worker.postMessage({ type, payload, id });
  });
}

// AI Worker API
export const ai = {
  loadModel: (modelName, callbacks) =>
    send(getAIWorker, 'LOAD_MODEL', { modelName }, callbacks),

  runInference: (payload, callbacks) =>
    send(getAIWorker, 'RUN_INFERENCE', payload, callbacks),

  getEmbedding: (text, callbacks) =>
    send(getAIWorker, 'GET_EMBEDDING', { text }, callbacks),

  getEmbeddingsBatch: (texts, callbacks) =>
    send(getAIWorker, 'GET_EMBEDDINGS_BATCH', { texts }, callbacks),

  checkModel: (modelName) =>
    send(getAIWorker, 'CHECK_MODEL', { modelName }),

  unloadModel: (modelName) =>
    send(getAIWorker, 'UNLOAD_MODEL', { modelName }),

  transcribeAudio: (audioData, callbacks) =>
    send(getAIWorker, 'TRANSCRIBE_AUDIO', { audioData }, callbacks),
};

// PDF Worker API
export const pdf = {
  extract: (arrayBuffer, filename, callbacks) =>
    send(getPDFWorker, 'EXTRACT_PDF', { arrayBuffer, filename }, callbacks),

  chunkText: (text, options, callbacks) =>
    send(getPDFWorker, 'CHUNK_TEXT', { text, options }, callbacks),
};

// Cleanup
export function terminateAll() {
  if (aiWorker) {
    aiWorker.terminate();
    aiWorker = null;
  }
  if (pdfWorker) {
    pdfWorker.terminate();
    pdfWorker = null;
  }
  pendingRequests.clear();
}
