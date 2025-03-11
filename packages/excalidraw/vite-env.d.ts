/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
  // The port to run the dev server
  VITE_APP_PORT: string;

  VITE_APP_BACKEND_V2_GET_URL: string;
  VITE_APP_BACKEND_V2_POST_URL: string;

  VITE_APP_LIBRARY_URL: string;
  VITE_APP_LIBRARY_BACKEND: string;

  // collaboration WebSocket server (https: string
  VITE_APP_WS_SERVER_URL: string;

  // set this only if using the collaboration workflow we use on excalidraw.com
  VITE_APP_PORTAL_URL: string;
  VITE_APP_AI_BACKEND: string;

  VITE_APP_FIREBASE_CONFIG: string;

  // whether to disable live reload / HMR. Usuaully what you want to do when
  // debugging Service Workers.
  VITE_APP_DEV_DISABLE_LIVE_RELOAD: string;

  FAST_REFRESH: string;

  // MATOMO
  VITE_APP_MATOMO_URL: string;
  VITE_APP_CDN_MATOMO_TRACKER_URL: string;
  VITE_APP_MATOMO_SITE_ID: string;

  //Debug flags

  // To enable bounding box for text containers
  VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX: string;
  VITE_APP_DISABLE_SENTRY: string;
  // Set this flag to false if you want to open the overlay by default
  VITE_APP_COLLAPSE_OVERLAY: string;
  // Enable eslint in dev server
  VITE_APP_ENABLE_ESLINT: string;
  VITE_APP_ENABLE_TRACKING: string;

  PKG_NAME: string;
  PKG_VERSION: string;

  VITE_APP_PLUS_LP: string;
  VITE_APP_PLUS_APP: string;

  VITE_WORKER_ID: string;
  MODE: string;
  DEV: string;
  PROD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
