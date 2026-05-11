// ============================================================
// AI Worker - Handles all ML inference off the main thread
// ============================================================

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js
env.allowLocalModels = false; // Use CDN for model downloads
env.useBrowserCache = true;   // Cache models in browser storage
env.backends.onnx.wasm.proxy = false; // Use direct WASM execution

// Model configurations
const MODEL_CONFIGS = {
  embedding: {
    name: 'Xenova/all-MiniLM-L6-v2',
    type: 'feature-extraction',
    size: '~80MB',
    instance: null,
    loading: false,
    loaded: false,
  },
  llm: {
    name: 'Xenova/LaMini-Flan-T5-783M',
    type: 'text2text-generation',
    size: '~1.5GB',
    instance: null,
    loading: false,
    loaded: false,
  },
  whisper: {
    name: 'Xenova/whisper-tiny.en',
    type: 'automatic-speech-recognition',
    size: '~150MB',
    instance: null,
    loading: false,
    loaded: false,
  },
};

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
      case 'UNLOAD_MODEL':
        handleUnloadModel(payload.modelName, id);
        break;
      case 'TRANSCRIBE_AUDIO':
        await handleTranscribeAudio(payload.audioData, id);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown type: ${type}`, id });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Unknown worker error',
      id,
    });
  }
};

// ============================================================
// Model Loading
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
      progress: 50,
      id,
    });
    return;
  }

  config.loading = true;

  self.postMessage({
    type: 'PROGRESS',
    status: 'loading',
    message: `Downloading ${config.name} (${config.size})...`,
    progress: 10,
    id,
  });

  try {
    // Create pipeline with progress callback
    config.instance = await pipeline(config.type, config.name, {
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          const percent = Math.round(
            (progress.loaded / progress.total) * 90
          );
          self.postMessage({
            type: 'PROGRESS',
            status: 'loading',
            message: `Downloading ${config.name}...`,
            progress: Math.min(10 + percent, 90),
            id,
          });
        }
      },
    });

    config.loaded = true;
    config.loading = false;

    self.postMessage({
      type: 'PROGRESS',
      status: 'loading',
      message: `${config.name} ready!`,
      progress: 100,
      id,
    });

    self.postMessage({ type: 'MODEL_LOADED', modelName, id });
  } catch (error) {
    config.loading = false;
    throw error;
  }
}

function handleCheckModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  self.postMessage({
    type: 'MODEL_STATUS',
    modelName,
    loaded: config?.loaded || false,
    loading: config?.loading || false,
    id,
  });
}

function handleUnloadModel(modelName, id) {
  const config = MODEL_CONFIGS[modelName];
  if (config) {
    config.instance = null;
    config.loaded = false;
    config.loading = false;
  }
  self.postMessage({ type: 'MODEL_UNLOADED', modelName, id });
}

// ============================================================
// Embedding Generation
// ============================================================
async function handleGetEmbedding(text, id) {
  const config = MODEL_CONFIGS.embedding;

  if (!config.loaded) {
    throw new Error('Embedding model not loaded. Load it first.');
  }

  const output = await config.instance(text, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array for transfer
  const embedding = Array.from(output.data);

  self.postMessage({
    type: 'EMBEDDING_RESULT',
    embedding,
    id,
  });
}

async function handleGetEmbeddingsBatch(texts, id) {
  const config = MODEL_CONFIGS.embedding;

  if (!config.loaded) {
    throw new Error('Embedding model not loaded. Load it first.');
  }

  const embeddings = [];

  for (let i = 0; i < texts.length; i++) {
    self.postMessage({
      type: 'PROGRESS',
      status: 'embedding',
      message: `Embedding chunk ${i + 1}/${texts.length}...`,
      progress: Math.round((i / texts.length) * 100),
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
    id,
  });
}

// ============================================================
// LLM Inference with Streaming
// ============================================================
async function handleInference(payload, id) {
  const { modelName, input, context, maxTokens = 256 } = payload;
  const config = MODEL_CONFIGS[modelName];

  if (!config || !config.loaded) {
    throw new Error(`Model ${modelName} not loaded. Load it first.`);
  }

  let prompt = input;

  // If context is provided (RAG), augment the prompt
  if (context && context.length > 0) {
    const contextStr = context
      .map((c, i) => `[Document ${i + 1}]: ${c}`)
      .join('\n\n');

    prompt = `You are a helpful AI assistant. Use the following context to answer the question. If the answer cannot be found in the context, say "I couldn't find that information in the provided documents."

Context:
${contextStr}

Question: ${input}

Answer:`;
  }

  self.postMessage({
    type: 'PROGRESS',
    status: 'generating',
    message: 'Generating response...',
    progress: 0,
    id,
  });

  try {
    // Generate with streaming
    const generator = await config.instance(prompt, {
      max_new_tokens: maxTokens,
      temperature: 0.7,
      do_sample: true,
      callback_function: (tokens) => {
        // This fires for each token generated
        // For T5 models, we get the full text incrementally
        const text = config.instance.tokenizer.decode(tokens[0], {
          skip_special_tokens: true,
        });

        // Extract only the new content
        self.postMessage({
          type: 'TOKEN',
          token: text,
          fullText: text,
          id,
        });
      },
    });

    // Final output
    const result = Array.isArray(generator) ? generator[0] : generator;
    const finalText =
      typeof result === 'string'
        ? result
        : result.generated_text || result.text || '';

    self.postMessage({
      type: 'INFERENCE_COMPLETE',
      result: finalText,
      id,
    });
  } catch (error) {
    // If streaming fails, try non-streaming fallback
    console.warn('Streaming failed, trying non-streaming:', error);

    const result = await config.instance(prompt, {
      max_new_tokens: maxTokens,
      temperature: 0.7,
      do_sample: true,
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
      id,
    });
  }
}

// ============================================================
// Audio Transcription
// ============================================================
async function handleTranscribeAudio(audioData, id) {
  const config = MODEL_CONFIGS.whisper;

  if (!config || !config.loaded) {
    throw new Error('Whisper model not loaded. Load it first.');
  }

  self.postMessage({
    type: 'PROGRESS',
    status: 'transcribing',
    message: 'Transcribing audio...',
    progress: 30,
    id,
  });

  const result = await config.instance(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });

  self.postMessage({
    type: 'TRANSCRIPTION_RESULT',
    text: result.text,
    id,
  });
}
