// ============================================================
// Security utilities — XSS sanitization (via DOMPurify), CSP, rate limiting, SSRF protection
// ============================================================

import DOMPurify from 'dompurify';

/**
 * Sanitize user-provided text to prevent XSS.
 * Uses DOMPurify — the standard, battle-tested sanitization library.
 */
export function sanitizeText(input) {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitize a conversation title
 */
export function sanitizeTitle(input) {
  return sanitizeText(input).slice(0, 200);
}

/**
 * Rate limiter for API calls — prevents abuse
 */
export class RateLimiter {
  constructor(maxCalls = 10, windowMs = 60000) {
    this.calls = new Map();
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  canCall(key) {
    const now = Date.now();
    const timestamps = this.calls.get(key) || [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);
    this.calls.set(key, valid);
    if (valid.length >= this.maxCalls) return false;
    valid.push(now);
    this.calls.set(key, valid);
    return true;
  }

  reset(key) {
    this.calls.delete(key);
  }
}

// Global rate limiters for different operations
export const webSearchRateLimiter = new RateLimiter(5, 60000); // 5 calls per minute
export const exportRateLimiter = new RateLimiter(3, 60000); // 3 exports per minute

/**
 * Validate a URL is safe to fetch (for external web search).
 * Uses exact hostname match (not substring) to prevent SSRF bypass via IP encoding tricks.
 */
export function isValidUrl(url, allowLocalhost = false) {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (!allowLocalhost) {
      // Exact-match blocklist for SSRF targets — prevents IP encoding bypasses
      const hostname = parsed.hostname.toLowerCase();
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254'];
      if (blockedHosts.includes(hostname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Content-Security-Policy directives.
 * This CSP prevents external resource loading & data exfiltration,
 * but does NOT prevent injected inline scripts from executing
 * ('unsafe-inline' is required because Vite emits an inline script tag in production).
 * For full coverage before main.jsx executes, deploy with public/_headers (Netlify/Cloudflare).
 */
export function getCSPDirectives() {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://huggingface.co',
      'https://cdn-lfs.huggingface.co',
      'https://api.allorigins.win',
      'https://api.duckduckgo.com',
    ],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
  };
}

/**
 * Apply CSP as a meta tag (for environments where HTTP headers can't be set).
 * Only takes effect once main.jsx executes. For full coverage before page load,
 * deploy with the public/_headers file.
 */
export function applyCSP() {
  const directives = getCSPDirectives();
  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  let meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', policy);
}
