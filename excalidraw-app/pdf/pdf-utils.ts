// PDF processing utilities migrated from public/pdf/pdf-utils.js

import type { PDFDocumentProxy } from 'pdfjs-dist';

// Global type declarations are now in global.d.ts

/**
 * Element interface with possible PDF custom data
 */
interface ElementWithPDFData {
  customData?: {
    pdf?: {
      originalFileId: string;
      page: number;
      pageCount: number;
      thumbnailCache?: Record<number, string>;
    };
  };
}

/**
 * PDF data extracted from element
 */
interface PDFData {
  originalFileId: string;
  page: number;
  pageCount: number;
  thumbnailCache?: Record<number, string>;
}

/**
 * Helper to check if an element has PDF data
 */
export const hasPDFData = (element: ElementWithPDFData): boolean => {
  return element?.customData?.pdf != null;
};

/**
 * Helper to get PDF data from element
 */
export const getPDFData = (element: ElementWithPDFData): PDFData | null => {
  if (hasPDFData(element) && element.customData && element.customData.pdf) {
    return element.customData.pdf;
  }
  return null;
};

// PDF.js worker instance (singleton)
let pdfWorker: unknown = null;

async function getPdfWorker() {
  if (!pdfWorker && typeof window !== 'undefined' && window.pdfjsLib) {
    pdfWorker = new window.pdfjsLib.PDFWorker();
  }
  return pdfWorker;
}

/**
 * Extract PDF document pages as images
 * @param pdfData PDF data as Uint8Array
 * @param outputScale Output scale for rendering (default: 1.0)
 * @returns Promise<Array<{ Bytes: Uint8Array; Width: number; Height: number; page: number }>>
 */
export async function extractPDFDocumentPages(
  pdfData: Uint8Array, 
  outputScale: number = 1.0
): Promise<Array<{ Bytes: Uint8Array; Width: number; Height: number; page: number }>> {
  if (typeof window === 'undefined' || !window.pdfjsLib) {
    throw new Error('PDF.js library not loaded');
  }

  let worker: unknown = null;
  let doc: PDFDocumentProxy | null = null;

  try {
    worker = await getPdfWorker();
    const loadingTask = window.pdfjsLib.getDocument({
      data: pdfData,
      verbosity: 0,
      worker: worker
    });

    doc = await loadingTask.promise;
    if (!doc) {
      throw new Error('Failed to load PDF document');
    }
    const result: Array<{ Bytes: Uint8Array; Width: number; Height: number; page: number }> = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const pageResult = await renderPdfPage(doc, pageNum, outputScale);
      result.push({ ...pageResult, page: pageNum });

      // Yield control periodically for better performance
      if (pageNum % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return result;
  } finally {
    if (doc) {
      await doc.destroy();
    }
  }
}

async function renderPdfPage(
  doc: PDFDocumentProxy, 
  pageNum: number, 
  outputScale: number
): Promise<{ Bytes: Uint8Array; Width: number; Height: number }> {
  const page = await doc.getPage(pageNum);

  try {
    const viewport = page.getViewport({ scale: 1 });
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    const MAX_DIMENSION = 4096;
    const scale = Math.min(
      outputScale,
      MAX_DIMENSION / width,
      MAX_DIMENSION / height
    );

    const scaledWidth = Math.floor(width * scale);
    const scaledHeight = Math.floor(height * scale);

    const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    const renderContext = {
      // OffscreenCanvasRenderingContext2D is acceptable for pdf.js renderer
      canvasContext: context as any, // Cast to avoid TS compatibility issues with pdf.js
      viewport: page.getViewport({ scale }),
      intent: 'print',
    };

    await page.render(renderContext).promise;

    const blob = await (canvas as any).convertToBlob({
      quality: 0.85,
      type: 'image/jpeg'
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());

    return {
      Bytes: bytes,
      Width: scaledWidth,
      Height: scaledHeight,
    };
  } finally {
    await page.cleanup();
  }
}

/**
 * Extract text content from PDF pages
 * @param pdfData PDF data as Uint8Array
 * @returns Promise<Array<{ page: number; text: string }>>
 */
export async function extractPDFText(
  pdfData: Uint8Array
): Promise<Array<{ page: number; text: string }>> {
  if (typeof window === 'undefined' || !window.pdfjsLib) {
    throw new Error('PDF.js library not loaded');
  }

  let worker: unknown = null;
  let doc: PDFDocumentProxy | null = null;

  try {
    worker = await getPdfWorker();
    const loadingTask = window.pdfjsLib.getDocument({
      data: pdfData,
      verbosity: 0,
      worker: worker
    });

    doc = await loadingTask.promise;
    if (!doc) {
      throw new Error('Failed to load PDF document');
    }
    const result: Array<{ page: number; text: string }> = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      
      try {
        const textContent = await page.getTextContent();
        const textItems = (textContent.items as Array<{ str?: string }>)
          .map((item) => item.str ?? '')
          .filter(Boolean);
        const pageText = textItems.join(' ').trim();
        
        result.push({
          page: pageNum,
          text: pageText
        });

        // Yield control periodically for better performance
        if (pageNum % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } finally {
        await page.cleanup();
      }
    }

    return result;
  } finally {
    if (doc) {
      await doc.destroy();
    }
  }
}

// Back-compat: attach to window for current callers
if (typeof window !== 'undefined') {
  window.extractPDFDocumentPages = extractPDFDocumentPages;
  window.extractPDFText = extractPDFText;
}