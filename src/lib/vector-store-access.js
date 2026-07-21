let vectorStorePromise = null;

export async function getVectorStore() {
  if (!vectorStorePromise) {
    vectorStorePromise = import('../workers/vector-store').then(({ getVectorStore: loadVectorStore }) =>
      loadVectorStore(),
    );
  }

  return vectorStorePromise;
}

export function resetVectorStore() {
  vectorStorePromise = null;
}
