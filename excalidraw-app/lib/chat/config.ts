// Environment configuration
// LLM service base URL configuration
export const getLLMBaseURL = (): string => (
  import.meta.env?.VITE_LLM_SERVICE_URL ??
  (window as any)?.__EXCALIDRAW_LLM_SERVICE_URL ??
  (window as any)?.__LLM_SERVICE_URL ??
  'http://localhost:3001'
);

// Thumbnail configuration
export const getThumbnailEnabled = (): boolean => {
  return String(
    import.meta.env.VITE_LLM_INCLUDE_THUMBNAIL_SNAPSHOT ??
    (window as any)?.__LLM_INCLUDE_THUMBNAIL_SNAPSHOT ??
    'false'
  ).toLowerCase() === 'true';
};

export const getMaxThumbnailDim = (): number =>
  Number(import.meta.env.VITE_LLM_THUMBNAIL_MAX_DIM ?? 512);

export const getThumbnailQuality = (): number =>
  Number(import.meta.env.VITE_LLM_THUMBNAIL_JPEG_QUALITY ?? 0.5);

export const getMaxThumbnailBytes = (): number =>
  Number(import.meta.env.VITE_LLM_THUMBNAIL_MAX_BYTES ?? 300000);

// Full canvas snapshot configuration
export const getFullCanvasMaxDim = (): number =>
  Number(import.meta.env.VITE_LLM_FULL_CANVAS_MAX_DIM ?? 400);

export const getFullCanvasQuality = (): number =>
  Number(import.meta.env.VITE_LLM_FULL_CANVAS_JPEG_QUALITY ?? 0.75);

export const getFullCanvasMaxBytes = (): number | undefined => {
  const val = Number(import.meta.env.VITE_LLM_FULL_CANVAS_MAX_BYTES ?? NaN);
  return Number.isFinite(val) ? val : undefined;
};

// Selection snapshot configuration
export const getSelectionMaxDim = (): number =>
  Number(import.meta.env.VITE_LLM_SELECTION_MAX_DIM ?? 800);

export const getSelectionQuality = (): number =>
  Number(import.meta.env.VITE_LLM_SELECTION_JPEG_QUALITY ?? 0.75);

export const getSelectionMaxBytes = (): number | undefined => {
  const val = Number(import.meta.env.VITE_LLM_SELECTION_MAX_BYTES ?? NaN);
  return Number.isFinite(val) ? val : undefined;
};

// Viewport snapshot configuration
export const getMaxViewportDim = (): number =>
  Number(import.meta.env.VITE_LLM_VIEWPORT_MAX_DIM ?? 900);

export const getViewportQuality = (): number =>
  Number(import.meta.env.VITE_LLM_VIEWPORT_JPEG_QUALITY ?? 0.8);

export const getMaxViewportBytes = (): number =>
  Number(import.meta.env.VITE_LLM_VIEWPORT_MAX_BYTES ?? 153600); // Default 150KB to match backend MAX_SNAPSHOT_SIZE

// Development mode check
export const isDev = (): boolean => Boolean(import.meta.env.DEV);

// Check if streaming is supported in environment
export const isStreamingSupported = (): boolean => {
  return typeof window !== 'undefined' && typeof window.EventSource !== 'undefined';
};
