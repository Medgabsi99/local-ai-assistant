// ============================================================
// Local LLM Server Connector
// Connects to Ollama, LM Studio, or any OpenAI-compatible API
// running locally on your machine.
// ============================================================

const DEFAULT_BASE_URL = 'http://localhost:11434'; // Ollama default
const DEFAULT_MODEL = 'llama3.2:1b'; // Tiny, runs on any machine
// For better quality: 'mistral', 'llama3.2:3b', 'qwen2.5:7b'
// Install Ollama from https://ollama.com

let config = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  enabled: false,
};

// Load config from localStorage
try {
  const saved = localStorage.getItem('llm-server-config');
  if (saved) {
    const parsed = JSON.parse(saved);
    config = { ...config, ...parsed };
  }
} catch (e) { console.warn('Server config load:', e); }

export function getServerConfig() {
  return { ...config };
}

export function setServerConfig(updates) {
  config = { ...config, ...updates };
  try {
    localStorage.setItem('llm-server-config', JSON.stringify(config));
  } catch (e) { console.warn('Server config save:', e); }
}

export async function checkServer() {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { available: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      available: true,
      models: (data.models || []).map((m) => m.name),
    };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

export async function generate(prompt, { onToken, onDone, maxTokens = 2048, temperature = 0.3 } = {}) {
  const res = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: !!onToken,
      options: {
        num_predict: maxTokens,
        temperature,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Server error: ${res.status} - ${text}`);
  }

  if (onToken) {
    // Streaming response
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullText += data.response;
            onToken(data.response, fullText);
          }
          if (data.done) {
            onDone?.(fullText);
          }
        } catch (e) { console.warn('Server config load:', e); }
      }
    }
    return fullText;
  } else {
    // Non-streaming
    const data = await res.json();
    return data.response || '';
  }
}
