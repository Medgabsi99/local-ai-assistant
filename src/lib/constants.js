// ============================================================
// Named constants — single source of truth for magic numbers
// ============================================================

// Polling intervals (ms)
export const MODEL_POLL_INTERVAL_MS = 3000;
export const MODEL_POLL_INITIAL_DELAY_MS = 0;

// Toast notifications
export const TOAST_DURATION_MS = 3000;

// Search
export const SEARCH_MIN_QUERY_LENGTH = 1;
export const SEARCH_MAX_RESULTS = 50;

// RAG / Vector search
export const RAG_TOP_K = 3;
export const RAG_MIN_SIMILARITY = 0.2;
export const RAG_VECTOR_WEIGHT = 0.6;
export const RAG_FETCH_MULTIPLIER = 3;

// Inference
export const INFERENCE_MAX_TOKENS = 512;
export const INFERENCE_TEMPERATURE = 0.3;
export const INFERENCE_SERVER_MAX_TOKENS = 2048;
export const INFERENCE_SERVER_TEMPERATURE = 0.3;
export const INFERENCE_HISTORY_LENGTH = 6;
export const INFERENCE_HISTORY_MAX_CHARS = 500;

// Audio recording
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_BITS_PER_SECOND = 64000;
export const AUDIO_CHUNK_INTERVAL_MS = 1000;

// Document processing
export const CHUNK_SIZE = 500;
export const CHUNK_OVERLAP = 100;
export const DOC_PREVIEW_MAX_CHARS = 10000;

// Web search
export const WEB_SEARCH_TIMEOUT_MS = 8000;
export const WEB_FETCH_MAX_CHARS = 2000;

// Tags
export const TAGS_MAX_COUNT = 20;

// UI
export const SCROLL_THRESHOLD_PX = 80;
export const ACCENT_COLORS = ['emerald', 'blue', 'violet', 'amber', 'rose', 'cyan'];