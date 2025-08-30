// PDF-specific utilities

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