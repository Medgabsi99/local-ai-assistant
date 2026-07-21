// ============================================================
// Security utilities — input sanitization, CSP, rate limiting
// ============================================================

/**
 * Sanitize user-provided text to prevent XSS
 */
export function sanitizeText(input) {
  if (!input) return '';
  // Strip HTML tags
  let text = input.replace(/<[^>]*>/g, '');
  // Decode HTML entities to prevent encoded XSS
  text = text.replace(/</g, '<').replace(/>/g, '>').replace(/&/g, '&');
  // Remove event handlers (onclick, onerror, etc.)
  text = text.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  text = text.replace(/\bon\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: URLs
  text = text.replace(/javascript:\s*/gi, '');
  // Remove data: URLs that could contain executable content
  text = text.replace(/data:\s*text\/html/gi, '');
  return text.trim();
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
    // Remove expired timestamps
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
 * Validate a URL is safe to fetch (for external web search)
 * Allows localhost for local LLM server connections
 */
export function isValidUrl(url, allowLocalhost = false) {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (!allowLocalhost) {
      // Block common SSRF targets for external fetches
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254'];
      if (blockedHosts.some((h) => parsed.hostname.includes(h))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Content-Security-Policy headers (for HTML meta tag or server config)
 */
export function getCSPDirectives() {
  return {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"], // unsafe-eval needed for transformers.js
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
  };
}

/**
 * Apply CSP as a meta tag (for environments where HTTP headers can't be set)
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
