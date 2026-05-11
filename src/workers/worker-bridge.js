let worker = null;
let pendingRequests = new Map();
let requestId = 0;

export function initWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event) => {
      const { id } = event.data;
      const pending = pendingRequests.get(id);

      if (pending) {
        if (event.data.type === 'ERROR') {
          pending.reject(new Error(event.data.error));
          pendingRequests.delete(id);
        } else if (
          event.data.type === 'MODEL_LOADED' ||
          event.data.type === 'INFERENCE_COMPLETE' ||
          event.data.type === 'MODEL_STATUS' ||
          event.data.type === 'EMBEDDING_RESULT'
        ) {
          pending.resolve(event.data);
          pendingRequests.delete(id);
        } else if (event.data.type === 'TOKEN') {
          // For streaming, call the onToken callback
          if (pending.onToken) {
            pending.onToken(event.data.token);
          }
        } else if (event.data.type === 'PROGRESS') {
          if (pending.onProgress) {
            pending.onProgress(event.data);
          }
        }
      }
    };
  }
  return worker;
}

export function sendToWorker(type, payload, callbacks = {}) {
  const id = ++requestId;
  const worker = initWorker();

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, {
      resolve,
      reject,
      onToken: callbacks.onToken,
      onProgress: callbacks.onProgress,
    });

    worker.postMessage({ type, payload, id });
  });
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
}
