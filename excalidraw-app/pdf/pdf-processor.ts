import { generateIdFromFile } from "@excalidraw/excalidraw/data/blob";
import { MIME_TYPES } from "@excalidraw/common";
import { storePDFThumbnails } from './pdf-storage.js';
import type { ProcessPDFResult, ThumbnailData, PDFPageResult } from './types/pdf.types.js';

// Configure PDF.js worker path
export const initializePDFJS = (): void => {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    // Set worker source to our build directory
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/build/pdf.worker.mjs';
  }
};

export async function processPDFFile(
  file: File, 
  position: { x: number; y: number },
  outputScale: number = 1.0
): Promise<ProcessPDFResult> {
  try {
    // Generate stable file ID based on content hash
    const originalFileId = await generateIdFromFile(file);
    
    // Convert file to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);

    // Use the global extractPDFDocumentPages function
    if (!window.extractPDFDocumentPages) {
      throw new Error('PDF processing library not loaded. Make sure pdf-utils.js is included.');
    }

    const pages = await window.extractPDFDocumentPages!(pdfData, outputScale);
    
    // Convert results to blob format for Excalidraw
    const thumbnails: ThumbnailData[] = await Promise.all(
      pages.map(async (pageResult: PDFPageResult, index: number): Promise<ThumbnailData> => {
        const blob = new Blob([pageResult.Bytes], { type: 'image/jpeg' });
        
        return {
          page: index + 1,
          blob,
          width: pageResult.Width,
          height: pageResult.Height,
        };
      })
    );

    // Store all thumbnails in IndexedDB for navigation
    try {
      await storePDFThumbnails(originalFileId, thumbnails);
    } catch (error) {
      console.warn('Failed to store PDF thumbnails:', error);
      // Don't fail the entire process if thumbnail storage fails
    }

    return {
      originalFileId,
      pageCount: pages.length,
      thumbnails, // Return thumbnails for immediate use
    };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function processPDFPage(
  originalFileId: string,
  pdfData: Uint8Array,
  pageNumber: number,
  outputScale: number = 1.0
): Promise<ThumbnailData | null> {
  try {
    if (!window.extractPDFDocumentPages) {
      throw new Error('PDF processing library not loaded');
    }

    const pages = await window.extractPDFDocumentPages!(pdfData, outputScale);
    const pageResult = pages[pageNumber - 1]; // Convert to 0-based index
    
    if (!pageResult) {
      return null;
    }

    const blob = new Blob([pageResult.Bytes], { type: 'image/jpeg' });
    
    return {
      page: pageNumber,
      blob,
      width: pageResult.Width,
      height: pageResult.Height,
    };
  } catch (error) {
    console.error('PDF page processing failed:', error);
    throw new Error(`Failed to process PDF page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}