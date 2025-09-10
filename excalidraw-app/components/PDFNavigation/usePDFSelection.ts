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
 * Provides functions to navigate between PDF pages using IndexedDB thumbnails
 */
export const usePDFNavigation = (excalidrawAPI: any, selectedElement: ExcalidrawElement | null) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const navigateToPage = async (page: number) => {
    if (!excalidrawAPI || !selectedElement || !isPDFImageElement(selectedElement) || isNavigating) {
      return;
    }

    try {
      setIsNavigating(true);
      setNavigationError(null);
      
      // Get current PDF info
      const pdfData = selectedElement.customData?.pdf;
      if (!pdfData) return;

      // Validate page number
      const targetPage = Math.max(1, Math.min(page, pdfData.pageCount));
      if (targetPage === pdfData.page) return; // Already on this page

      // Import navigation handler dynamically to avoid build issues
      const { navigatePDFPage } = await import('../../pdf/pdf-navigation-handler');
      
      // Use the navigation handler to switch pages
      await navigatePDFPage(excalidrawAPI, selectedElement, targetPage);
      
    } catch (error) {
      console.error('Error navigating PDF page:', error);
      setNavigationError(error instanceof Error ? error.message : 'Navigation failed');
    } finally {
      setIsNavigating(false);
    }
  };

  const goToPrevPage = async () => {
    if (!excalidrawAPI || !selectedElement || isNavigating) return;
    
    try {
      setIsNavigating(true);
      setNavigationError(null);
      
      const { goToPrevPage: prevPageHandler } = await import('../../pdf/pdf-navigation-handler');
      await prevPageHandler(excalidrawAPI, selectedElement);
      
    } catch (error) {
      console.error('Error navigating to previous page:', error);
      setNavigationError(error instanceof Error ? error.message : 'Navigation failed');
    } finally {
      setIsNavigating(false);
    }
  };

  const goToNextPage = async () => {
    if (!excalidrawAPI || !selectedElement || isNavigating) return;
    
    try {
      setIsNavigating(true);
      setNavigationError(null);
      
      const { goToNextPage: nextPageHandler } = await import('../../pdf/pdf-navigation-handler');
      await nextPageHandler(excalidrawAPI, selectedElement);
      
    } catch (error) {
      console.error('Error navigating to next page:', error);
      setNavigationError(error instanceof Error ? error.message : 'Navigation failed');
    } finally {
      setIsNavigating(false);
    }
  };

  // Check if navigation is possible
  const canNavigatePrev = selectedElement?.customData?.pdf && 
    selectedElement.customData.pdf.page > 1;
  
  const canNavigateNext = selectedElement?.customData?.pdf && 
    selectedElement.customData.pdf.page < selectedElement.customData.pdf.pageCount;

  return {
    navigateToPage,
    goToPrevPage,
    goToNextPage,
    isNavigating,
    navigationError,
    canNavigatePrev,
    canNavigateNext
  };
};