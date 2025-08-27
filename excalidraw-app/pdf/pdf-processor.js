import { generateIdFromFile } from "@excalidraw/excalidraw/data/blob";
import { MIME_TYPES } from "@excalidraw/common";

// Configure PDF.js worker path
export const initializePDFJS = () => {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    // Set worker source to our build directory
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/build/pdf.worker.mjs';
  }
};

export async function processPDFFile(
  file, 
  position,
  outputScale = 1.0
) {
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

    const pages = await window.extractPDFDocumentPages(pdfData, outputScale);
    
    // Convert results to blob format for Excalidraw
    const thumbnails = await Promise.all(
      pages.map(async (pageResult, index) => {
        const blob = new Blob([pageResult.Bytes], { type: 'image/jpeg' });
        
        return {
          page: index + 1,
          blob,
          width: pageResult.Width,
          height: pageResult.Height,
        };
      })
    );

    return {
      originalFileId,
      pageCount: pages.length,
      thumbnails,
    };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function processPDFPage(
  originalFileId,
  pdfData,
  pageNumber,
  outputScale = 1.0
) {
  try {
    if (!window.extractPDFDocumentPages) {
      throw new Error('PDF processing library not loaded');
    }

    const pages = await window.extractPDFDocumentPages(pdfData, outputScale);
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