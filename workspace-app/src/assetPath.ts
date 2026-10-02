/**
 * The editor loads its fonts from `window.EXCALIDRAW_ASSET_PATH` and only falls back to a public CDN
 * when that is unset. Setting it from a module (instead of an inline <script>) keeps the page
 * compatible with a strict Content-Security-Policy (`script-src 'self'`) and guarantees fonts come
 * from OUR origin. This file must be the first import of the entry point.
 */
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
  window.location.origin;

export {};
