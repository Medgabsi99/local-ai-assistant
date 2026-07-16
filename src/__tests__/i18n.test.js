import { describe, it, expect } from 'vitest';
import { t, setLanguage, getLanguage, getLanguages } from '../lib/i18n';

describe('i18n translations', () => {
  it('returns English by default', () => {
    expect(getLanguage()).toBe('en');
  });

  it('returns the key itself for missing keys', () => {
    const result = t('nonexistent_key_xyz');
    expect(result).toBe('nonexistent_key_xyz');
  });

  it('returns English text for known keys in default lang', () => {
    expect(t('app_name')).toBe('Local AI');
    expect(t('chat')).toBe('Chat');
    expect(t('documents')).toBe('Documents');
  });

  it('returns all three language codes', () => {
    const langs = getLanguages();
    expect(langs).toContain('en');
    expect(langs).toContain('fr');
    expect(langs).toContain('ar');
  });

  it('switches to French and returns French text', () => {
    setLanguage('fr');
    expect(getLanguage()).toBe('fr');
    expect(t('app_name')).toBe('IA Locale');
    expect(t('chat')).toBe('Discussion');
    // Reset back to English
    setLanguage('en');
    expect(t('app_name')).toBe('Local AI');
  });

  it('switches to Arabic and returns Arabic text', () => {
    setLanguage('ar');
    expect(getLanguage()).toBe('ar');
    expect(t('app_name')).toBe('الذكاء المحلي');
    // Reset back to English
    setLanguage('en');
  });

  it('interpolates params correctly', () => {
    const result = t('messages_count', { n: 42 });
    expect(result).toContain('42');
    expect(result).toContain('messages');
  });

  it('has all required keys for EN', () => {
    const requiredKeys = [
      'app_name', 'chat', 'documents', 'settings', 'new_chat', 'search_conv',
      'download', 'unload', 'cancel', 'save', 'clear', 'send',
      'rag_mode', 'web_search', 'system', 'regenerate', 'copy', 'edit', 'del',
      'read_aloud', 'search_messages', 'share', 'messages_count', 'sources',
      'bold', 'italic', 'code', 'link', 'list', 'code_block', 'markdown',
      'star', 'unstar', 'archive', 'restore', 'archive', 'archived',
      'model_embedding', 'model_language', 'model_whisper', 'switch_model',
      'active', 'downloading', 'memory_warning',
      'error_title', 'error_body', 'reload',
      'tags', 'separate_with', 'tags_placeholder', 'vectors',
    ];
    for (const key of requiredKeys) {
      const val = t(key);
      expect(val).not.toBe(key); // should NOT return the key itself
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it('has French translations for all required keys', () => {
    setLanguage('fr');
    const keys = ['app_name', 'chat', 'documents', 'settings', 'rag_mode', 'web_search'];
    for (const key of keys) {
      const val = t(key);
      expect(val).not.toBe(key); // should be translated, not falling back to key
      expect(val.length).toBeGreaterThan(0);
    }
    setLanguage('en');
  });

  it('has Arabic translations for all required keys', () => {
    setLanguage('ar');
    const keys = ['app_name', 'chat', 'documents', 'settings', 'rag_mode', 'web_search'];
    for (const key of keys) {
      const val = t(key);
      expect(val).not.toBe(key);
      expect(val.length).toBeGreaterThan(0);
    }
    setLanguage('en');
  });
});