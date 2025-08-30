import { Viewport } from './useViewportTracking';

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  customData?: {
    pdf?: {
      page: number;
      pageCount: number;
      originalFileId?: string;
      thumbnailCache?: Record<number, string>;
    };
  };
}

export interface ScreenPosition {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
}

export interface ControlsPosition {
  left: number;
  top: number;
  transform: string;
  transformOrigin: string;
  zIndex: number;
}

/**
 * Convert element coordinates to screen coordinates
 * @param element - The Excalidraw element
 * @param viewport - Current viewport state (scroll, zoom)
 * @returns Screen position coordinates
 */
export const getScreenPosition = (element: ExcalidrawElement, viewport: Viewport): ScreenPosition => {
  const { x, y, width, height } = element;
  const { scrollX, scrollY, zoom } = viewport;
  
  return {
    screenX: (x + scrollX) * zoom,
    screenY: (y + scrollY) * zoom,
    screenWidth: width * zoom,
    screenHeight: height * zoom
  };
};

/**
 * Calculate position for PDF navigation controls inside the selection rectangle
 * Controls are positioned at bottom-center of the element
 * @param element - The selected PDF image element
 * @param viewport - Current viewport state
 * @param controlsWidth - Width of the controls (default 120px)
 * @param controlsHeight - Height of the controls (default 32px)
 * @returns CSS position properties for the controls
 */
export const getControlsPosition = (
  element: ExcalidrawElement, 
  viewport: Viewport,
  controlsWidth = 120,
  controlsHeight = 32
): ControlsPosition => {
  const { screenX, screenY, screenWidth, screenHeight } = getScreenPosition(element, viewport);
  
  // Position controls at bottom-center, inside the selection rectangle
  const centerX = screenX + (screenWidth / 2);
  const bottomY = screenY + screenHeight - 40; // 40px margin from bottom edge
  
  return {
    left: centerX - (controlsWidth / 2),  // No scale multiplier - consistent pixel size
    top: bottomY - controlsHeight,        // No scale multiplier - consistent pixel size
    transform: 'none',                    // No scaling transform - like selection handles
    transformOrigin: 'center bottom',
    zIndex: 1000 // Ensure controls appear above canvas content
  };
};

/**
 * Check if controls are within visible viewport bounds
 * @param position - Control position
 * @param controlsWidth - Width of controls
 * @param controlsHeight - Height of controls
 * @param viewportBounds - Viewport boundaries
 * @returns Whether controls are visible
 */
export const isControlsVisible = (
  position: ControlsPosition,
  controlsWidth = 120,
  controlsHeight = 32,
  viewportBounds = { width: window.innerWidth, height: window.innerHeight }
): boolean => {
  const { left, top } = position;
  
  return (
    left >= -controlsWidth &&
    left <= viewportBounds.width &&
    top >= -controlsHeight &&
    top <= viewportBounds.height
  );
};

/**
 * Check if an element is a PDF image (image element with PDF customData)
 * @param element - Element to check
 * @returns Whether element is a PDF image
 */
export const isPDFImageElement = (element: ExcalidrawElement): boolean => {
  return Boolean(
    element?.type === 'image' &&
    element?.customData?.pdf &&
    typeof element.customData.pdf.page === 'number' &&
    typeof element.customData.pdf.pageCount === 'number' &&
    element.customData.pdf.pageCount > 1
  );
};

/**
 * Get PDF info from element customData
 * @param element - PDF image element
 * @returns PDF page info or null
 */
export const getPDFInfo = (element: ExcalidrawElement) => {
  if (!isPDFImageElement(element)) return null;
  
  return {
    currentPage: element.customData!.pdf!.page,
    totalPages: element.customData!.pdf!.pageCount,
    originalFileId: element.customData!.pdf!.originalFileId
  };
};