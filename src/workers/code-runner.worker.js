// ============================================================
// Code Runner Worker — Sandboxed JavaScript execution
// Runs user/AI-generated code in a controlled Web Worker
// with no access to DOM, localStorage, or network fetch
// ============================================================

// Override fetch to prevent network access
self.fetch = null;
self.XMLHttpRequest = null;
self.WebSocket = null;
self.importScripts = null;

// Shadow self to prevent access to IndexedDB and other origin-scoped APIs
// new Function() resolves free identifiers against the global scope,
// so we must override self at the global level.
Object.defineProperty(self, 'self', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'indexedDB', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'caches', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'location', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'navigator', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'window', { value: null, writable: false, configurable: false });
Object.defineProperty(self, 'globalThis', { value: null, writable: false, configurable: false });

// Whitelist of safe globals available to user code
const SAFE_GLOBALS = {
  console: {
    log: (...args) => self.postMessage({ type: 'CONSOLE', level: 'log', args: args.map(String) }),
    warn: (...args) => self.postMessage({ type: 'CONSOLE', level: 'warn', args: args.map(String) }),
    error: (...args) => self.postMessage({ type: 'CONSOLE', level: 'error', args: args.map(String) }),
    info: (...args) => self.postMessage({ type: 'CONSOLE', level: 'info', args: args.map(String) }),
  },
  Math,
  JSON,
  Date,
  RegExp,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Promise,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURI,
  encodeURIComponent,
  decodeURI,
  decodeURIComponent,
  ArrayBuffer,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Float32Array,
  Float64Array,
  BigInt,
  BigInt64Array,
  BigUint64Array,
  Symbol,
  Reflect,
  Proxy,
  Atomics,
  SharedArrayBuffer,
  DataView,
  TextEncoder,
  TextDecoder,
};

// Main-thread watchdog: if the main thread sends a TERMINATE message, kill this worker
self.onmessage = function (event) {
  const { type, payload, id } = event.data;

  if (type === 'TERMINATE') {
    self.close();
    return;
  }

  const code = payload?.code;
  const timeout = 5000;

  const result = {
    id,
    logs: [],
    error: null,
    output: null,
    timeMs: 0,
  };

  const startTime = performance.now();

  // Set up a polling-based watchdog for synchronous infinite loops.
  // The timeout fires only when the stack is empty, so we use a separate
  // approach: the main thread will terminate this worker if it doesn't
  // respond within the timeout period. We signal back on completion.
  const timeoutId = setTimeout(() => {
    // If we reach here, the code completed (or threw) — this is a fallback
    // for async code that hangs. Synchronous infinite loops are handled
    // by the main thread's terminate-on-timeout logic.
  }, timeout);

  try {
    // Build the function arguments from safe globals
    const keys = Object.keys(SAFE_GLOBALS);
    const values = keys.map((k) => SAFE_GLOBALS[k]);

    // Create and execute the function in sandboxed scope
    const fn = new Function(
      ...keys,
      `
      "use strict";
      ${code}
    `,
    );

    const output = fn(...values);

    // Handle Promise results
    if (output instanceof Promise) {
      output
        .then((resolved) => {
          clearTimeout(timeoutId);
          result.output = resolved !== undefined ? String(resolved) : undefined;
          result.timeMs = Math.round(performance.now() - startTime);
          self.postMessage({ type: 'CODE_RESULT', ...result });
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          result.error = err.message || String(err);
          result.timeMs = Math.round(performance.now() - startTime);
          self.postMessage({ type: 'CODE_RESULT', ...result });
        });
      return;
    }

    clearTimeout(timeoutId);
    result.output = output !== undefined ? String(output) : undefined;
    result.timeMs = Math.round(performance.now() - startTime);
    self.postMessage({ type: 'CODE_RESULT', ...result });
  } catch (err) {
    clearTimeout(timeoutId);
    result.error = err.message || String(err);
    result.timeMs = Math.round(performance.now() - startTime);
    self.postMessage({ type: 'CODE_RESULT', ...result });
  }
};
