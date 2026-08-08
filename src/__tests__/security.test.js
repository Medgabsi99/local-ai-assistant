import { describe, it, expect } from 'vitest';
import { isPrivateHost, isSafeImageSrc, isSafeLinkHref, isValidUrl } from '../lib/security';

describe('security helpers', () => {
  it('blocks private and local hosts', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.0.0.4')).toBe(true);
    expect(isPrivateHost('192.168.1.10')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('[::ffff:7f00:1]')).toBe(true);
    expect(isPrivateHost('example.com')).toBe(false);
  });

  it('rejects urls with credentials and private targets', () => {
    expect(isValidUrl('https://user:pass@example.com')).toBe(false);
    expect(isValidUrl('https://127.0.0.1')).toBe(false);
    expect(isValidUrl('http://[::ffff:127.0.0.1]')).toBe(false);
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('only allows safe markdown image sources', () => {
    expect(isSafeImageSrc('img:123')).toBe(true);
    expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(true);
    expect(isSafeImageSrc('blob:https://app.example/id')).toBe(true);
    expect(isSafeImageSrc('https://example.com/image.png')).toBe(false);
  });

  it('only allows safe markdown link targets', () => {
    expect(isSafeLinkHref('/docs')).toBe(true);
    expect(isSafeLinkHref('https://example.com')).toBe(false);
    expect(isSafeLinkHref('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkHref('https://user:pass@example.com')).toBe(false);
    expect(isSafeLinkHref('https://127.0.0.1')).toBe(false);
  });
});
