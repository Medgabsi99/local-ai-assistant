// ============================================================
// Code Runner Worker — Sandboxed JavaScript execution
// Runs user/AI-generated code in a controlled Web Worker
// with no access to DOM, localStorage, or network fetch
// ============================================================

// Override fetch to prevent network access
self.fetch = null;
self.XMLHttpRequest = null;
self.WebSocket = null;

// Override importScripts to prevent loading external scripts
self.importScripts = null;

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

self.onmessage = function (event) {
  const { type, payload, id } = event.data;
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

  // Set up a timeout
  const timeoutId = setTimeout(() => {
    result.error = 'Execution timed out after ' + timeout + 'ms';
    self.postMessage({ type: 'CODE_RESULT', ...result });
  }, timeout);

  try {
    // Build the function arguments from safe globals
    const keys = Object.keys(SAFE_GLOBALS);
    const values = keys.map((k) => SAFE_GLOBALS[k]);

    // Create and execute the function in sandboxed scope
    const fn = new Function(...keys, `
      "use strict";
      ${code}
    `);

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