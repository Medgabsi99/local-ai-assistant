// ============================================================
// PDF Extraction Worker
// ============================================================

let pdfjsLib = null;

async function initPDFJS() {
  if (pdfjsLib) return pdfjsLib;

  // Dynamic import of pdfjs-dist
  pdfjsLib = await import('pdfjs-dist');

  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  return pdfjsLib;
}

self.onmessage = async function (event) {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'EXTRACT_PDF':
        await handleExtractPDF(payload.arrayBuffer, payload.filename, id);
        break;
      case 'CHUNK_TEXT':
        handleChunkText(payload.text, payload.options, id);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown type: ${type}`, id });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'PDF extraction failed',
      id,
    });
  }
};

async function handleExtractPDF(arrayBuffer, filename, id) {
  const pdfjs = await initPDFJS();

  self.postMessage({
    type: 'PROGRESS',
    status: 'extracting',
    message: `Loading ${filename}...`,
    progress: 10,
    id,
  });

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  let fullText = '';
  const pages = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const progress = 10 + Math.round((pageNum / totalPages) * 80);

    self.postMessage({
      type: 'PROGRESS',
      status: 'extracting',
      message: `Extracting page ${pageNum}/${totalPages}...`,
      progress,
      id,
    });

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });

    fullText += pageText + '\n\n';
  }

  self.postMessage({
    type: 'EXTRACTION_COMPLETE',
    text: fullText.trim(),
    pages,
    totalPages,
    filename,
    id,
  });
}

function handleChunkText(text, options = {}, id) {
  const {
    chunkSize = 500, // characters per chunk
    chunkOverlap = 100, // overlap between chunks
    maxChunks = 100, // safety limit
  } = options;

  const chunks = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    let end = start + chunkSize;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const searchRegion = text.slice(end - 50, end + 50);
      const sentenceBreak = searchRegion.search(/[.!?]\s+/);

      if (sentenceBreak !== -1) {
        end = end - 50 + sentenceBreak + 1;
      }
    }

    const chunk = text.slice(start, Math.min(end, text.length)).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    start = end - chunkOverlap;

    if (start >= text.length) break;
  }

  self.postMessage({
    type: 'CHUNK_COMPLETE',
    chunks,
    totalChunks: chunks.length,
    id,
  });
}
