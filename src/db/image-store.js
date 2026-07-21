// ============================================================
// Image Storage — persists images in IndexedDB
// Images are stored as base64 data URLs keyed by a unique ID
// ============================================================

import Dexie from 'dexie';

const IMAGE_DB_NAME = 'LocalAIImages';

class ImageDB extends Dexie {
  constructor() {
    super(IMAGE_DB_NAME);
    this.version(1).stores({
      images: '++id, name, mimeType, createdAt',
    });
  }
}

let db = null;

function getDb() {
  if (!db) db = new ImageDB();
  return db;
}

/**
 * Store an image (base64 data URL) and return its ID
 */
export async function storeImage(dataUrl, name) {
  const db = getDb();
  const mimeType = dataUrl.split(';')[0].split(':')[1] || 'image/png';
  return db.images.add({
    dataUrl,
    name,
    mimeType,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Get an image by ID
 */
export async function getImage(id) {
  const db = getDb();
  return db.images.get(id);
}

/**
 * Delete an image by ID
 */
export async function deleteImage(id) {
  const db = getDb();
  return db.images.delete(id);
}

/**
 * Get all image IDs for a list (for cleanup)
 */
export async function getAllImageIds() {
  const db = getDb();
  return (await db.images.toArray()).map((img) => img.id);
}