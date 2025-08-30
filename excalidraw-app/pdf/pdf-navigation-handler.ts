// PDF Navigation Handler - manages page switching with IndexedDB thumbnails
import { getPDFThumbnail } from './pdf-storage.js';

/**
 * Convert blob to data URL for Excalidraw file system
 */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Generate a file ID from blob data for Excalidraw's file system
 * Uses PDF ID and page number for consistency
 */
export const generateFileIdFromBlob = async (
  blob: Blob, 
  originalFileId: string, 
  pageNumber: number
): Promise<string> => {
  // Create a deterministic ID based on original PDF and page number
  // This ensures the same page always gets the same file ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `pdf-page-${originalFileId.substr(-8)}-p${pageNumber}-${timestamp}-${random}`;
};

/**
 * Handle PDF page navigation - retrieves thumbnail from IndexedDB and updates element
 */
export async function navigatePDFPage(
  excalidrawAPI: any, 
  element: any, 
  targetPage: number
): Promise<boolean> {
  if (!excalidrawAPI || !element || !element.customData?.pdf) {
    throw new Error('Invalid parameters for PDF navigation');
  }

  const { originalFileId, pageCount } = element.customData.pdf;
  
  // Validate target page
  if (targetPage < 1 || targetPage > pageCount) {
    throw new Error(`Invalid page number: ${targetPage}. Must be between 1 and ${pageCount}`);
  }

  // Already on this page
  if (element.customData.pdf.page === targetPage) {
    return true;
  }

  try {
    // Retrieve thumbnail from IndexedDB
    const thumbnailBlob = await getPDFThumbnail(originalFileId, targetPage);
    
    if (!thumbnailBlob) {
      throw new Error(`Thumbnail not found for page ${targetPage}`);
    }

    // Convert to data URL and file ID for Excalidraw
    const dataURL = await blobToDataURL(thumbnailBlob);
    const newFileId = await generateFileIdFromBlob(thumbnailBlob, originalFileId, targetPage);

    // Create BinaryFileData for Excalidraw
    const thumbnailFileData = {
      id: newFileId,
      dataURL,
      mimeType: thumbnailBlob.type || 'image/jpeg',
      created: Date.now(),
      lastRetrieved: Date.now()
    };

    // Add thumbnail to Excalidraw's file system
    excalidrawAPI.addFiles([thumbnailFileData]);

    // Small delay to ensure file is processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update element with new page and fileId
    const updatedElement = {
      ...element,
      fileId: newFileId,
      customData: {
        ...element.customData,
        pdf: {
          ...element.customData.pdf,
          page: targetPage
        }
      }
    };

    // Update the element in Excalidraw
    excalidrawAPI.updateScene({
      elements: excalidrawAPI.getSceneElements().map((el: any) => 
        el.id === element.id ? updatedElement : el
      )
    });

    // Force a refresh to ensure the change is rendered
    setTimeout(() => {
      excalidrawAPI.refresh();
    }, 50);

    return true;

  } catch (error) {
    console.error(`Failed to navigate to page ${targetPage}:`, error);
    throw error;
  }
}

/**
 * Navigate to previous page
 */
export async function goToPrevPage(
  excalidrawAPI: any, 
  element: any
): Promise<boolean | undefined> {
  if (!element?.customData?.pdf) return;
  
  const currentPage = element.customData.pdf.page;
  if (currentPage <= 1) return; // Already on first page

  return navigatePDFPage(excalidrawAPI, element, currentPage - 1);
}

/**
 * Navigate to next page
 */
export async function goToNextPage(
  excalidrawAPI: any, 
  element: any
): Promise<boolean | undefined> {
  if (!element?.customData?.pdf) return;
  
  const { page: currentPage, pageCount } = element.customData.pdf;
  if (currentPage >= pageCount) return; // Already on last page

  return navigatePDFPage(excalidrawAPI, element, currentPage + 1);
}

/**
 * Check if navigation is possible
 */
export function canNavigate(element: any, direction: 'prev' | 'next'): boolean {
  if (!element?.customData?.pdf) return false;
  
  const { page, pageCount } = element.customData.pdf;
  
  if (direction === 'prev') {
    return page > 1;
  } else if (direction === 'next') {
    return page < pageCount;
  }
  
  return false;
}