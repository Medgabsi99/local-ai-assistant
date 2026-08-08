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
 * Blocks credentials, localhost, and private-network IP ranges to reduce SSRF risk.
 */
export function isValidUrl(url, allowLocalhost = false) {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsed.protocol)) return false;

    if (parsed.username || parsed.password) return false;

    if (!allowLocalhost) {
      const hostname = parsed.hostname.toLowerCase();
      if (isPrivateHost(hostname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine whether a hostname resolves to a local or private target.
 * This is intentionally strict for browser-side fetches.
 */
export function isPrivateHost(hostname) {
  const normalized = String(hostname).trim().toLowerCase();
  if (!normalized) return true;

  const host = normalized.replace(/^\[/, '').replace(/\]$/, '');

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home')) return true;

  if (host.startsWith('::ffff:')) {
    const mapped = host.slice('::ffff:'.length);
    if (isPrivateIpv4(mapped)) return true;

    const hextets = mapped.split(':');
    if (hextets.length === 2 && hextets.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
      const first = Number.parseInt(hextets[0], 16);
      const second = Number.parseInt(hextets[1], 16);
      const octets = [(first >> 8) & 255, first & 255, (second >> 8) & 255, second & 255];
      if (isPrivateIpv4(octets)) return true;
    }
  }

  if (isPrivateIpv4(host)) return true;

  if (host.includes(':')) {
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  }

  return false;
}

function isPrivateIpv4(value) {
  const text = Array.isArray(value) ? value.join('.') : String(value).trim().toLowerCase();
  const ipv4Match = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const octets = ipv4Match.slice(1).map(Number);
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return true;

  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 0) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first >= 224) return true;
  return false;
}

/**
 * Restrict markdown image sources to local, embedded, or app-managed images.
 * This prevents passive remote image loads from leaking user IP and referrer data.
 */
export function isSafeImageSrc(src) {
  if (typeof src !== 'string' || !src.trim()) return false;
  const value = src.trim();
  if (value.startsWith('img:')) return true;
  if (value.startsWith('data:') || value.startsWith('blob:')) return true;

  try {
    const parsed = new URL(value, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Restrict markdown links to safe navigation targets.
 * Allows only same-origin or relative destinations; blocks all external navigation.
 */
export function isSafeLinkHref(href) {
  if (typeof href !== 'string' || !href.trim()) return false;
  const value = href.trim();

  if (value.startsWith('#')) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;

  try {
    const parsed = new URL(value, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Content-Security-Policy directives.
 * This CSP prevents external resource loading & data exfiltration,
 * while still allowing the app's runtime requirements.
 * For full coverage before main.jsx executes, deploy with public/_headers (Netlify/Cloudflare).
 */
export function getCSPDirectives() {
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'script-src': ["'self'", "'unsafe-eval'"],
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
  // 'frame-ancestors' is ignored when delivered via a <meta> element
  // (it can only be set via HTTP headers, which public/_headers handles)
  const { 'frame-ancestors': _ignored, ...metaDirectives } = directives;
  const policy = Object.entries(metaDirectives)
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
