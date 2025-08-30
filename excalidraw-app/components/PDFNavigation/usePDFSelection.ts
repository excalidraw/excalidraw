import { useEffect, useState } from 'react';
import { ExcalidrawElement, isPDFImageElement } from './coordinateUtils';

export interface PDFSelectionState {
  selectedElement: ExcalidrawElement | null;
  isVisible: boolean;
  currentPage: number;
  totalPages: number;
}

/**
 * Hook to track PDF element selection changes
 * Monitors Excalidraw selection state and identifies when PDF images are selected
 */
export const usePDFSelection = (excalidrawAPI: any): PDFSelectionState => {
  const [selectionState, setSelectionState] = useState<PDFSelectionState>({
    selectedElement: null,
    isVisible: false,
    currentPage: 1,
    totalPages: 1
  });

  useEffect(() => {
    if (!excalidrawAPI) return;

    // Function to find selected PDF element
    const findSelectedPDFElement = (elements: ExcalidrawElement[], selectedElementIds: Record<string, boolean>): ExcalidrawElement | null => {
      const selectedIds = Object.keys(selectedElementIds || {});
      
      // Find the first selected element that is a PDF image
      for (const id of selectedIds) {
        const element = elements.find(el => el.id === id);
        if (element && isPDFImageElement(element)) {
          return element;
        }
      }
      
      return null;
    };

    // Subscribe to selection changes
    let unsubscribe: (() => void) | null = null;
    
    try {
      if (excalidrawAPI.onChange) {
        unsubscribe = excalidrawAPI.onChange((elements: ExcalidrawElement[], appState: any) => {
          const selectedPDFElement = findSelectedPDFElement(elements, appState.selectedElementIds || {});
          
          if (selectedPDFElement) {
            // PDF element is selected
            const pdfData = selectedPDFElement.customData?.pdf;
            setSelectionState({
              selectedElement: selectedPDFElement,
              isVisible: true,
              currentPage: pdfData?.page || 1,
              totalPages: pdfData?.pageCount || 1
            });
          } else {
            // No PDF element selected
            setSelectionState({
              selectedElement: null,
              isVisible: false,
              currentPage: 1,
              totalPages: 1
            });
          }
        });
      }
    } catch (error) {
      console.warn('Error setting up PDF selection tracking:', error);
    }

    // Cleanup subscription
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error cleaning up PDF selection tracking:', error);
        }
      }
    };
  }, [excalidrawAPI]);

  return selectionState;
};

/**
 * Hook to handle PDF page navigation
 * Provides functions to navigate between PDF pages
 */
export const usePDFNavigation = (excalidrawAPI: any, selectedElement: ExcalidrawElement | null) => {
  const navigateToPage = async (page: number) => {
    if (!excalidrawAPI || !selectedElement || !isPDFImageElement(selectedElement)) {
      return;
    }

    try {
      // Get current PDF info
      const pdfData = selectedElement.customData?.pdf;
      if (!pdfData) return;

      // Validate page number
      const targetPage = Math.max(1, Math.min(page, pdfData.pageCount));
      if (targetPage === pdfData.page) return; // Already on this page

      // Update element's customData to reflect new page
      const updatedElement = {
        ...selectedElement,
        customData: {
          ...selectedElement.customData,
          pdf: {
            ...pdfData,
            page: targetPage
          }
        }
      };

      // Update the element in Excalidraw
      // Note: This would require implementing the PDF page change logic
      // For now, we'll prepare the structure for the integration
      console.log('Navigate to page:', targetPage, 'for element:', selectedElement.id);
      
      // TODO: Implement actual PDF page switching logic
      // This would involve:
      // 1. Loading the new page thumbnail from storage
      // 2. Updating the element's fileId to point to the new thumbnail
      // 3. Triggering a re-render of the element
      
    } catch (error) {
      console.error('Error navigating PDF page:', error);
    }
  };

  const goToPrevPage = () => {
    if (selectedElement?.customData?.pdf) {
      const currentPage = selectedElement.customData.pdf.page;
      navigateToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (selectedElement?.customData?.pdf) {
      const currentPage = selectedElement.customData.pdf.page;
      navigateToPage(currentPage + 1);
    }
  };

  return {
    navigateToPage,
    goToPrevPage,
    goToNextPage
  };
};