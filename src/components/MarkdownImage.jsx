import { useState, useEffect } from 'react';
import { resolveImageSrc } from '../hooks/useImageAttachments';
import * as security from '../lib/security';

function isSafeImageSrc(src) {
  if (typeof security.isSafeImageSrc === 'function') {
    return security.isSafeImageSrc(src);
  }

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
 * Custom markdown image component that resolves img:ID references from IndexedDB.
 * Shows a pulsing skeleton loader while the image loads.
 * Uses <span> instead of <div> to avoid hydration errors when rendered inside <p> tags.
 *
 * @param {Object} props
 * @param {string} props.src - Image URL or "img:{id}" reference from IndexedDB
 * @param {string} [props.alt] - Alt text for the image
 * @returns {JSX.Element}
 */
export default function MarkdownImage({ src, alt }) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (src?.startsWith('img:')) {
      const id = parseInt(src.slice(4), 10);
      if (Number.isFinite(id)) {
        resolveImageSrc(id).then((resolved) => {
          if (!cancelled) setImgSrc(resolved);
        });
      } else {
        setImgSrc(null);
      }
    } else {
      setImgSrc(isSafeImageSrc(src) ? src : null);
    }
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <span className="block my-2">
      {imgSrc ? (
        <img src={imgSrc} alt={alt || ''} className="max-w-full rounded-lg" style={{ maxHeight: '400px' }} />
      ) : (
        <span className="block w-full h-32 bg-slate-800 rounded-lg animate-pulse" />
      )}
    </span>
  );
}
