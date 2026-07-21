// ============================================================
// useImageAttachments — drag-drop, paste, and preview images
// Stores images in IndexedDB for persistence across page loads
// ============================================================

import { useState, useCallback } from 'react';
import { storeImage, getImage } from '../db/image-store';
import { ai } from '../workers/worker-bridge';

export function useImageAttachments() {
  const [pendingImages, setPendingImages] = useState([]);
  const [processingImage, setProcessingImage] = useState(false);

  const addImage = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return null;

    setProcessingImage(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const id = await storeImage(dataUrl, file.name);
      let visionLoaded = false;
      const imageEntry = { id, dataUrl, name: file.name, caption: null, visionLoaded: false };

      // Try to caption with vision model if loaded
      try {
        const status = await ai.checkAllModels();
        visionLoaded = status?.statuses?.vision?.loaded ?? false;
        imageEntry.visionLoaded = visionLoaded;
        if (visionLoaded) {
          const result = await ai.captionImage(dataUrl);
          if (result?.caption) {
            imageEntry.caption = result.caption;
          }
        }
      } catch {
        /* vision not available */
      }

      setPendingImages((prev) => [...prev, imageEntry]);
      return imageEntry;
    } finally {
      setProcessingImage(false);
    }
  }, []);

  const removeImage = useCallback((id) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const clearImages = useCallback(() => {
    setPendingImages([]);
  }, []);

  const handleFileDrop = useCallback(
    async (e) => {
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      for (const file of files) {
        await addImage(file);
      }
      return files.length > 0;
    },
    [addImage],
  );

  const handlePaste = useCallback(
    async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) await addImage(file);
        }
      }
    },
    [addImage],
  );

  const buildMessageContent = useCallback(
    (text) => {
      let content = text;
      for (const img of pendingImages) {
        const imgMarkdown = `![${img.name}](img:${img.id})`;
        const caption = img.caption ? `\n> 📷 ${img.caption}` : '';
        content = content ? `${content}\n\n${imgMarkdown}${caption}` : `${imgMarkdown}${caption}`;
      }
      return content;
    },
    [pendingImages],
  );

  return {
    pendingImages,
    processingImage,
    addImage,
    removeImage,
    clearImages,
    handleFileDrop,
    handlePaste,
    buildMessageContent,
  };
}

/**
 * Resolve an image ID to its data URL from IndexedDB
 */
export async function resolveImageSrc(id) {
  try {
    const img = await getImage(id);
    return img?.dataUrl || null;
  } catch {
    return null;
  }
}
