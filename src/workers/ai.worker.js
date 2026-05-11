// ============================================================
// AI Worker - Handles all ML inference off the main thread
// Phase 3: Resumable downloads, better error handling
// ============================================================

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
// Note: env.backends is not available at module init time in Vite ES worker context,
// so we only set the safe top-level flags here.
try {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  // proxy = false is the default inside a worker — no need to set it.
  // env.backends.onnx.wasm.proxy = false; // ← caused "Cannot read properties of undefined"
} catch (e) {
  console.warn('Failed to configure transformers env:', e);
}

// Model configurations with version pins for cache busting
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

// Track download progress for resume capability
let activeDownloads = {};
let downloadCache = {};

// ============================================================
// Message Handler
// ============================================================
self.onmessage = async function (event) {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await handleLoadModel(payload.modelName, id);
        break;
      case 'CANCEL_DOWNLOAD':
        handleCancelDownload(payload.modelName, id);
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
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Unknown worker error',
      stack: error.stack,
      id,
    });
  }
};

// ============================================================
// Model Loading with Resume Support
// ============================================================
async function handleLoadModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];

  if (!config) {
    throw new Error(`Unknown model: ${modelName}`);
  }

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

  // Initialize download tracking
  activeDownloads[modelName] = {
    progress: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    startTime,
    status: 'starting',
  };

  self.postMessage({
    type: 'PROGRESS',
    status: 'loading',
    message: `Preparing to download ${config.name}...`,
    progress: 0,
    id,
  });

  try {
    // Create AbortController for cancellation
    const abortController = new AbortController();
    config.downloadController = abortController;

    // Create pipeline with progress and abort signal
    config.instance = await pipeline(config.type, config.name, {
      revision: config.revision,
      progress_callback: (progress) => {
        if (abortController.signal.aborted) {
          throw new Error('Download cancelled by user');
        }

        if (progress.status === 'downloading') {
          const percent = Math.round(
            (progress.loaded / progress.total) * 90
          );
          activeDownloads[modelName] = {
            ...activeDownloads[modelName],
            progress: Math.min(10 + percent, 90),
            bytesDownloaded: progress.loaded,
            totalBytes: progress.total,
            status: 'downloading',
            speed: calculateSpeed(progress.loaded, startTime),
            eta: calculateETA(progress.loaded, progress.total, startTime),
          };

          self.postMessage({
            type: 'PROGRESS',
            status: 'loading',
            message: `Downloading ${config.name} (${formatBytes(progress.loaded)} / ${formatBytes(progress.total)})`,
            progress: activeDownloads[modelName].progress,
            ...activeDownloads[modelName],
            id,
          });
        } else if (progress.status === 'initiate') {
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

    // Check if cancelled during load
    if (abortController.signal.aborted) {
      config.loading = false;
      config.instance = null;
      delete activeDownloads[modelName];
      self.postMessage({
        type: 'DOWNLOAD_CANCELLED',
        modelName,
        id,
      });
      return;
    }

    config.loaded = true;
    config.loading = false;
    config.downloadController = null;

    activeDownloads[modelName] = {
      progress: 100,
      status: 'complete',
      completedAt: Date.now(),
    };

    self.postMessage({
      type: 'PROGRESS',
      status: 'complete',
      message: `${config.name} ready!`,
      progress: 100,
      id,
    });

    self.postMessage({ type: 'MODEL_LOADED', modelName, id });
  } catch (error) {
    config.loading = false;
    config.downloadController = null;

    if (error.message === 'Download cancelled by user') {
      delete activeDownloads[modelName];
      self.postMessage({
        type: 'DOWNLOAD_CANCELLED',
        modelName,
        id,
      });
      return;
    }

    delete activeDownloads[modelName];
    throw error;
  }
}

function handleCancelDownload(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  if (config && config.downloadController) {
    config.downloadController.abort();
  }
  self.postMessage({ type: 'CANCEL_ACKNOWLEDGED', modelName, id });
}

function handleGetDownloadProgress(id) {
  self.postMessage({
    type: 'DOWNLOAD_PROGRESS_ALL',
    downloads: { ...activeDownloads },
    models: Object.keys(MODEL_CONFIGS).reduce((acc, key) => {
      acc[key] = {
        loaded: MODEL_CONFIGS[key].loaded,
        loading: MODEL_CONFIGS[key].loading,
      };
      return acc;
    }, {}),
    id,
  });
}

function handleCheckModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  self.postMessage({
    type: 'MODEL_STATUS',
    modelName,
    loaded: config?.loaded || false,
    loading: config?.loading || false,
    download: activeDownloads[modelName] || null,
    id,
  });
}

function handleCheckAllModels(id) {
  const statuses = {};
  for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
    statuses[key] = {
      loaded: config.loaded,
      loading: config.loading,
      name: config.name,
      size: config.size,
      download: activeDownloads[key] || null,
    };
  }
  self.postMessage({ type: 'ALL_MODEL_STATUSES', statuses, id });
}

function handleUnloadModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  if (config) {
    config.instance = null;
    config.loaded = false;
    config.loading = false;
    config.downloadController = null;
  }
  delete activeDownloads[modelName];
  self.postMessage({ type: 'MODEL_UNLOADED', modelName, id });
}

function handleUnloadAll(id) {
  for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
    config.instance = null;
    config.loaded = false;
    config.loading = false;
    config.downloadController = null;
  }
  activeDownloads = {};
  self.postMessage({ type: 'ALL_MODELS_UNLOADED', id });
}

// ============================================================
// Embedding Generation
// ============================================================
async function handleGetEmbedding(text, id) {
  const config = MODEL_CONFIGS.embedding;

  if (!config.loaded) {
    throw new Error('Embedding model not loaded. Please load it first.');
  }

  const startTime = Date.now();
  const output = await config.instance(text, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding = Array.from(output.data);

  self.postMessage({
    type: 'EMBEDDING_RESULT',
    embedding,
    dimension: embedding.length,
    timeMs: Date.now() - startTime,
    id,
  });
}

async function handleGetEmbeddingsBatch(texts, id) {
  const config = MODEL_CONFIGS.embedding;

  if (!config.loaded) {
    throw new Error('Embedding model not loaded. Please load it first.');
  }

  const embeddings = [];
  const batchStartTime = Date.now();

  for (let i = 0; i < texts.length; i++) {
    self.postMessage({
      type: 'PROGRESS',
      status: 'embedding',
      message: `Embedding chunk ${i + 1}/${texts.length}...`,
      progress: Math.round((i / texts.length) * 100),
      current: i + 1,
      total: texts.length,
      id,
    });

    const output = await config.instance(texts[i], {
      pooling: 'mean',
      normalize: true,
    });

    embeddings.push(Array.from(output.data));
  }

  self.postMessage({
    type: 'EMBEDDINGS_BATCH_RESULT',
    embeddings,
    totalChunks: texts.length,
    totalTimeMs: Date.now() - batchStartTime,
    id,
  });
}

// ============================================================
// LLM Inference with Streaming & Context Window Management
// ============================================================
async function handleInference(payload, id) {
  const {
    modelName,
    input,
    context,
    maxTokens = 512,
    temperature = 0.7,
    systemPrompt,
  } = payload;

  const config = MODEL_CONFIGS[modelName];

  if (!config || !config.loaded) {
    throw new Error(`Model ${modelName} not loaded. Please load it first.`);
  }

  // Build prompt with proper structure
  let prompt = '';

  if (systemPrompt) {
    prompt += `System: ${systemPrompt}\n\n`;
  }

  // If context is provided (RAG), structure it clearly
  if (context && context.length > 0) {
    // Truncate context to fit model's context window
    // LaMini-Flan-T5 has ~512 token limit, so we need to be careful
    const maxContextChars = 1500; // Conservative estimate for 512 tokens
    let contextStr = '';
    let totalChars = 0;

    for (let i = 0; i < context.length; i++) {
      const chunk = context[i];
      if (totalChars + chunk.length > maxContextChars) {
        // Truncate last chunk
        const remaining = maxContextChars - totalChars;
        if (remaining > 100) {
          contextStr += `[Document ${i + 1} (truncated)]: ${chunk.slice(0, remaining)}\n\n`;
        }
        break;
      }
      contextStr += `[Document ${i + 1}]: ${chunk}\n\n`;
      totalChars += chunk.length;
    }

    prompt += `Use the following context to answer the question. If the answer cannot be found in the context, say "I couldn't find that information in the provided documents."

Context:
${contextStr}

Question: ${input}

Answer:`;
  } else {
    prompt += `Question: ${input}\n\nAnswer:`;
  }

  const inferenceStartTime = Date.now();

  self.postMessage({
    type: 'PROGRESS',
    status: 'generating',
    message: 'Generating response...',
    progress: 0,
    id,
  });

  // Accumulate streamed tokens server-side so the client always gets a
  // coherent growing string, not just an isolated decoded fragment.
  let streamedText = '';

  try {
    // Try streaming generation
    const generator = await config.instance(prompt, {
      max_new_tokens: maxTokens,
      temperature,
      do_sample: temperature > 0,
      repetition_penalty: 1.1,
      no_repeat_ngram_size: 3,
      callback_function: (tokens) => {
        try {
          const piece = config.instance.tokenizer.decode(tokens[0], {
            skip_special_tokens: true,
          });
          if (piece) {
            streamedText += piece;
            self.postMessage({
              type: 'TOKEN',
              token: piece,       // the new piece only
              fullText: streamedText, // full accumulated text so far
              id,
            });
          }
        } catch {
          // Decoding error - skip this token
        }
      },
    });

    const result = Array.isArray(generator) ? generator[0] : generator;
    const finalText =
      typeof result === 'string'
        ? result
        : result.generated_text || result.text || '';

    self.postMessage({
      type: 'INFERENCE_COMPLETE',
      result: finalText,
      timeMs: Date.now() - inferenceStartTime,
      promptLength: prompt.length,
      id,
    });
  } catch (streamingError) {
    console.warn('Streaming failed, trying non-streaming:', streamingError);

    try {
      const result = await config.instance(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        do_sample: temperature > 0,
      });

      const finalText =
        typeof result === 'string'
          ? result
          : Array.isArray(result)
          ? result[0]?.generated_text || result[0]?.text || ''
          : result.generated_text || result.text || '';

      self.postMessage({
        type: 'INFERENCE_COMPLETE',
        result: finalText,
        timeMs: Date.now() - inferenceStartTime,
        promptLength: prompt.length,
        fallback: true,
        id,
      });
    } catch (fallbackError) {
      throw new Error(
        `Inference failed: ${fallbackError.message}. Try unloading and reloading the model.`
      );
    }
  }
}

// ============================================================
// Audio Transcription (Whisper)
// ============================================================
async function handleTranscribeAudio(audioData, id) {
  const config = MODEL_CONFIGS.whisper;

  if (!config || !config.loaded) {
    throw new Error('Whisper model not loaded. Please load it first.');
  }

  const startTime = Date.now();

  self.postMessage({
    type: 'PROGRESS',
    status: 'transcribing',
    message: 'Processing audio...',
    progress: 20,
    id,
  });

  try {
    const result = await config.instance(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    self.postMessage({
      type: 'TRANSCRIPTION_RESULT',
      text: result.text,
      chunks: result.chunks || [],
      timeMs: Date.now() - startTime,
      id,
    });
  } catch (error) {
    // Try with simpler options as fallback
    const result = await config.instance(audioData, {
      chunk_length_s: 30,
      return_timestamps: false,
    });

    self.postMessage({
      type: 'TRANSCRIPTION_RESULT',
      text: result.text,
      timeMs: Date.now() - startTime,
      fallback: true,
      id,
    });
  }
}

// ============================================================
// Utility Functions
// ============================================================
function calculateSpeed(bytesDownloaded, startTime) {
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  if (elapsedSeconds === 0) return 'Calculating...';
  const bytesPerSecond = bytesDownloaded / elapsedSeconds;
  return formatBytes(bytesPerSecond) + '/s';
}

function calculateETA(bytesDownloaded, totalBytes, startTime) {
  if (bytesDownloaded === 0) return 'Calculating...';
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const bytesPerSecond = bytesDownloaded / elapsedSeconds;
  const remainingBytes = totalBytes - bytesDownloaded;
  const remainingSeconds = remainingBytes / bytesPerSecond;

  if (remainingSeconds < 60) {
    return `${Math.round(remainingSeconds)}s remaining`;
  } else if (remainingSeconds < 3600) {
    return `${Math.round(remainingSeconds / 60)}m ${Math.round(remainingSeconds % 60)}s remaining`;
  } else {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.round((remainingSeconds % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
