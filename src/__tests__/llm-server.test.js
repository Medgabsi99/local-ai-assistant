import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerConfig, setServerConfig, checkServer, generate } from '../lib/llm-server';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

globalThis.fetch = vi.fn();

describe('llm-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('getServerConfig', () => {
    it('returns default config when nothing is saved', () => {
      const config = getServerConfig();
      expect(config).toEqual({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2:1b',
        enabled: false,
      });
    });

    it('returns a copy of the config (not the internal object)', () => {
      const config = getServerConfig();
      config.baseUrl = 'http://changed:11434';
      const config2 = getServerConfig();
      expect(config2.baseUrl).toBe('http://localhost:11434');
    });
  });

  describe('setServerConfig', () => {
    it('merges updates into the config', () => {
      setServerConfig({ enabled: true });
      const config = getServerConfig();
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBe('http://localhost:11434');
    });

    it('persists to localStorage', () => {
      setServerConfig({ model: 'mistral' });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'llm-server-config',
        expect.stringContaining('mistral'),
      );
    });
  });

  describe('checkServer', () => {
    it('returns available: false when fetch fails', async () => {
      globalThis.fetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await checkServer();
      expect(result.available).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('returns available: false on non-ok response', async () => {
      globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await checkServer();
      expect(result.available).toBe(false);
    });

    it('returns available: true with models on success', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.2:1b' }, { name: 'mistral' }] }),
      });
      const result = await checkServer();
      expect(result.available).toBe(true);
      expect(result.models).toContain('llama3.2:1b');
    });
  });

  describe('generate', () => {
    it('throws on non-ok response', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      await expect(generate('test prompt')).rejects.toThrow('Server error: 500');
    });

    it('returns response text for non-streaming', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Hello from Ollama!' }),
      });
      const result = await generate('test prompt');
      expect(result).toBe('Hello from Ollama!');
    });
  });
});