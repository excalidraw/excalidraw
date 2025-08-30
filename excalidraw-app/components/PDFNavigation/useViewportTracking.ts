import { useEffect, useState } from 'react';

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/**
 * Hook to track Excalidraw viewport changes (pan, zoom) in real-time
 * Uses debounced updates for smooth 60fps performance
 */
export const useViewportTracking = (excalidrawAPI: any): Viewport => {
  const [viewport, setViewport] = useState<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1
  });

  useEffect(() => {
    if (!excalidrawAPI) return;

    let rafId: number;
    let lastUpdate = 0;
    const THROTTLE_MS = 16; // ~60fps

    // Throttled viewport update function
    const throttledUpdate = (scrollX: number, scrollY: number, zoom: number) => {
      const now = Date.now();
      
      if (now - lastUpdate >= THROTTLE_MS) {
        setViewport({ scrollX, scrollY, zoom });
        lastUpdate = now;
      } else {
        // Schedule update for next frame if we're throttling
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setViewport({ scrollX, scrollY, zoom });
          lastUpdate = Date.now();
        });
      }
    };

    // Primary method: onScrollChange provides direct scroll/zoom events
    let unsubscribeScroll: (() => void) | null = null;
    
    try {
      if (excalidrawAPI.onScrollChange) {
        unsubscribeScroll = excalidrawAPI.onScrollChange((scrollX: number, scrollY: number, zoom: number) => {
          throttledUpdate(scrollX, scrollY, zoom);
        });
      }
    } catch (error) {
      console.warn('onScrollChange not available, falling back to onChange');
    }

    // Fallback: general state change tracking
    let unsubscribeChange: (() => void) | null = null;
    
    try {
      if (excalidrawAPI.onChange) {
        unsubscribeChange = excalidrawAPI.onChange((elements: any[], appState: any) => {
          if (appState && appState.zoom && typeof appState.zoom.value === 'number') {
            throttledUpdate(
              appState.scrollX || 0,
              appState.scrollY || 0,
              appState.zoom.value || 1
            );
          }
        });
      }
    } catch (error) {
      console.warn('onChange not available for viewport tracking');
    }

    // Cleanup function
    return () => {
      cancelAnimationFrame(rafId);
      
      if (unsubscribeScroll) {
        try {
          unsubscribeScroll();
        } catch (error) {
          console.warn('Error unsubscribing from scroll changes:', error);
        }
      }
      
      if (unsubscribeChange) {
        try {
          unsubscribeChange();
        } catch (error) {
          console.warn('Error unsubscribing from state changes:', error);
        }
      }
    };
  }, [excalidrawAPI]);

  return viewport;
};