// ============================================================
// Consistent error handling policy
// - Logs to console in dev
// - Shows toast notification when available
// ============================================================

let toastFn = null;

export function setToastHandler(fn) {
  toastFn = fn;
}

export function reportError(error, context = '', showToast = false) {
  // Always log to console
  if (context) {
    console.warn(`[${context}]`, error?.message || error);
  } else {
    console.warn(error?.message || error);
  }

  // Optionally show user-facing toast
  if (showToast && toastFn) {
    const msg = error?.message || String(error);
    toastFn(msg, 'error');
  }
}

// Wraps a try/catch with consistent logging
export async function tryCatch(promise, context = '', showToast = false) {
  try {
    return await promise;
  } catch (error) {
    reportError(error, context, showToast);
    return null;
  }
}

// Wraps a non-async function
export function tryCatchSync(fn, context = '', showToast = false) {
  try {
    return fn();
  } catch (error) {
    reportError(error, context, showToast);
    return null;
  }
}