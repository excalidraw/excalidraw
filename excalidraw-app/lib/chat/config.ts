// Environment configuration and feature flags
export const getStreamingFeatureFlag = (): boolean => {
  return String(
    import.meta.env.VITE_CHAT_EXEC_STREAMING_ENABLED ??
    (window as any)?.__CHAT_EXEC_STREAMING_ENABLED ??
    'false'
  ).toLowerCase() === 'true';
};

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

// Development mode check
export const isDev = (): boolean => Boolean(import.meta.env.DEV);

// Check if streaming is supported in environment
export const isStreamingSupported = (): boolean => {
  return typeof window !== 'undefined' && typeof window.EventSource !== 'undefined';
};