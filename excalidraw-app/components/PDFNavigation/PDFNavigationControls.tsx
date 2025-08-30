import React from 'react';
import { useViewportTracking } from './useViewportTracking';
import { usePDFSelection, usePDFNavigation } from './usePDFSelection';
import { getControlsPosition, isControlsVisible } from './coordinateUtils';
import styles from './styles/navigation-controls.module.css';

interface PDFNavigationControlsProps {
  excalidrawAPI: any;
}

/**
 * PDF Navigation Controls Component
 * Renders navigation UI for selected PDF elements with real-time positioning
 * that follows viewport changes (pan/zoom)
 */
export const PDFNavigationControls: React.FC<PDFNavigationControlsProps> = ({ 
  excalidrawAPI 
}) => {
  // Track viewport changes (pan/zoom)
  const viewport = useViewportTracking(excalidrawAPI);
  
  // Track PDF element selection
  const pdfSelection = usePDFSelection(excalidrawAPI);
  
  // Navigation handlers
  const { goToPrevPage, goToNextPage } = usePDFNavigation(excalidrawAPI, pdfSelection.selectedElement);
  
  // Don't render if no PDF is selected
  if (!pdfSelection.isVisible || !pdfSelection.selectedElement) {
    return null;
  }

  // Calculate position for controls
  const position = getControlsPosition(pdfSelection.selectedElement, viewport);
  
  // Check if controls would be visible in viewport
  const isVisible = isControlsVisible(position);
  
  if (!isVisible) {
    return null;
  }

  const { currentPage, totalPages } = pdfSelection;
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  return (
    <div 
      className={styles.navigationControls}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: position.transform,
        transformOrigin: position.transformOrigin,
        zIndex: position.zIndex
      }}
      data-testid="pdf-navigation-controls"
    >
      {/* Previous Page Button */}
      <button
        className={`${styles.controlButton} ${styles.prevButton}`}
        onClick={goToPrevPage}
        disabled={!hasPrevPage}
        title={`Go to page ${currentPage - 1}`}
        aria-label={`Previous page (${currentPage - 1})`}
        data-testid="pdf-prev-button"
      />
      
      {/* Page Info */}
      <span 
        className={styles.pageInfo}
        title={`Page ${currentPage} of ${totalPages}`}
        data-testid="pdf-page-info"
      >
        {currentPage}/{totalPages}
      </span>
      
      {/* Next Page Button */}
      <button
        className={`${styles.controlButton} ${styles.nextButton}`}
        onClick={goToNextPage}
        disabled={!hasNextPage}
        title={`Go to page ${currentPage + 1}`}
        aria-label={`Next page (${currentPage + 1})`}
        data-testid="pdf-next-button"
      />
    </div>
  );
};

export default PDFNavigationControls;